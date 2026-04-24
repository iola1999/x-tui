import { describe, expect, it } from 'bun:test'
import {
  buildNativeImageClearSequence,
  fitImageCellsIntoBox,
  fitNativeImageBox,
  measureNativeImagePlacement,
  measureNativeImageCellOrigin,
  runAfterInkRenderForElement,
  resolveNativeImageProtocol,
  resolveImageViewerMode,
  shouldReuseNativeImagePaint,
} from '../imageViewerNative.js'

describe('resolveImageViewerMode', () => {
  it('uses native protocol rendering for iTerm2 and Kitty-class terminals', () => {
    expect(resolveImageViewerMode('iterm2')).toBe('native')
    expect(resolveImageViewerMode('kitty')).toBe('native')
  })

  it('falls back to halfblock when no native protocol renderer is wired', () => {
    expect(resolveImageViewerMode('halfblock')).toBe('halfblock')
    expect(resolveImageViewerMode('sixel')).toBe('halfblock')
  })
})

describe('resolveNativeImageProtocol', () => {
  it('returns a native protocol only for terminals we can actually encode for', () => {
    expect(resolveNativeImageProtocol('iterm2')).toBe('iterm2')
    expect(resolveNativeImageProtocol('kitty')).toBe('kitty')
    expect(resolveNativeImageProtocol('halfblock')).toBeNull()
    expect(resolveNativeImageProtocol('sixel')).toBeNull()
  })
})

describe('fitNativeImageBox', () => {
  it('fits a wide image inside the centered viewer bounds', () => {
    const box = fitNativeImageBox({
      columns: 100,
      rows: 30,
      imageWidth: 1600,
      imageHeight: 900,
    })

    expect(box.widthCells).toBe(78)
    expect(box.heightCells).toBe(22)
    expect(box.col).toBe(12)
    expect(box.row).toBe(4)
  })

  it('fits a tall image without exceeding the available terminal body', () => {
    const box = fitNativeImageBox({
      columns: 100,
      rows: 30,
      imageWidth: 900,
      imageHeight: 1600,
    })

    expect(box.widthCells).toBe(25)
    expect(box.heightCells).toBe(22)
    expect(box.col).toBe(38)
    expect(box.row).toBe(4)
  })
})

describe('fitImageCellsIntoBox', () => {
  it('preserves portrait aspect ratio inside a fixed thumbnail box', () => {
    expect(
      fitImageCellsIntoBox({
        maxCols: 16,
        maxRows: 8,
        imageWidth: 900,
        imageHeight: 1600,
      }),
    ).toEqual({
      widthCells: 9,
      heightCells: 8,
    })
  })

  it('preserves landscape aspect ratio inside a fixed thumbnail box', () => {
    expect(
      fitImageCellsIntoBox({
        maxCols: 16,
        maxRows: 8,
        imageWidth: 1600,
        imageHeight: 900,
      }),
    ).toEqual({
      widthCells: 16,
      heightCells: 5,
    })
  })
})

describe('measureNativeImageCellOrigin', () => {
  it('walks parent layout offsets and subtracts scroll containers', () => {
    const leaf = {
      yogaNode: {
        getComputedTop: () => 4,
        getComputedLeft: () => 6,
      },
      parentNode: {
        yogaNode: {
          getComputedTop: () => 10,
          getComputedLeft: () => 8,
        },
        scrollTop: 3,
        parentNode: {
          yogaNode: {
            getComputedTop: () => 2,
            getComputedLeft: () => 1,
          },
          parentNode: undefined,
        },
      },
    }

    expect(measureNativeImageCellOrigin(leaf as never)).toEqual({ row: 14, col: 16 })
  })

  it('uses rendered scroll offset for origin measurement during virtual scroll clamp', () => {
    const leaf = {
      yogaNode: {
        getComputedTop: () => 4,
        getComputedLeft: () => 6,
      },
      parentNode: {
        yogaNode: {
          getComputedTop: () => 10,
          getComputedLeft: () => 8,
        },
        scrollTop: 50,
        renderedScrollTop: 3,
        parentNode: undefined,
      },
    }

    expect(measureNativeImageCellOrigin(leaf as never)).toEqual({ row: 12, col: 15 })
  })
})

describe('measureNativeImagePlacement', () => {
  it('marks boxes below the viewport as not visible so they are not painted', () => {
    const leaf = {
      yogaNode: {
        getComputedTop: () => 30,
        getComputedLeft: () => 6,
        getComputedHeight: () => 8,
      },
      parentNode: {
        yogaNode: {
          getComputedTop: () => 10,
          getComputedLeft: () => 2,
        },
        parentNode: undefined,
      },
    }

    expect(measureNativeImagePlacement(leaf as never, 24)).toEqual({
      row: 41,
      col: 9,
      height: 8,
      visible: false,
    })
  })

  it('marks boxes intersecting the viewport as visible after scrollTop is applied', () => {
    const leaf = {
      yogaNode: {
        getComputedTop: () => 20,
        getComputedLeft: () => 4,
        getComputedHeight: () => 8,
      },
      parentNode: {
        yogaNode: {
          getComputedTop: () => 2,
          getComputedLeft: () => 1,
        },
        scrollTop: 10,
        parentNode: undefined,
      },
    }

    expect(measureNativeImagePlacement(leaf as never, 24)).toEqual({
      row: 13,
      col: 6,
      height: 8,
      visible: true,
    })
  })

  it('uses the rendered scroll offset when virtual scroll clamps the visual frame', () => {
    const leaf = {
      yogaNode: {
        getComputedTop: () => 20,
        getComputedLeft: () => 4,
        getComputedHeight: () => 8,
      },
      parentNode: {
        yogaNode: {
          getComputedTop: () => 2,
          getComputedLeft: () => 1,
        },
        scrollTop: 100,
        renderedScrollTop: 10,
        parentNode: undefined,
      },
    }

    expect(measureNativeImagePlacement(leaf as never, 24)).toEqual({
      row: 13,
      col: 6,
      height: 8,
      visible: true,
    })
  })

  it('does not paint boxes that are only partially visible above the viewport', () => {
    const leaf = {
      yogaNode: {
        getComputedTop: () => 2,
        getComputedLeft: () => 4,
        getComputedHeight: () => 8,
      },
      parentNode: {
        yogaNode: {
          getComputedTop: () => 1,
          getComputedLeft: () => 1,
        },
        scrollTop: 5,
        parentNode: undefined,
      },
    }

    expect(measureNativeImagePlacement(leaf as never, 24)).toEqual({
      row: -1,
      col: 6,
      height: 8,
      visible: false,
    })
  })

  it('does not paint boxes that are only partially visible below the viewport', () => {
    const leaf = {
      yogaNode: {
        getComputedTop: () => 20,
        getComputedLeft: () => 4,
        getComputedHeight: () => 8,
      },
      parentNode: {
        yogaNode: {
          getComputedTop: () => 1,
          getComputedLeft: () => 1,
        },
        parentNode: undefined,
      },
    }

    expect(measureNativeImagePlacement(leaf as never, 24)).toEqual({
      row: 22,
      col: 6,
      height: 8,
      visible: false,
    })
  })
})

describe('buildNativeImageClearSequence', () => {
  it('falls back to blanking the previously painted cell rectangle for iTerm2', () => {
    expect(
      buildNativeImageClearSequence('iterm2', {
        row: 3,
        col: 5,
        widthCells: 4,
        heightCells: 2,
      }),
    ).toBe('\x1b7\x1b[3;5H    \x1b[4;5H    \x1b8')
  })

  it('uses kitty placement deletion when the terminal supports it', () => {
    expect(
      buildNativeImageClearSequence('kitty', {
        row: 3,
        col: 5,
        widthCells: 4,
        heightCells: 2,
      }),
    ).toBe('\x1b_Ga=d,d=P,x=5,y=3,q=2\x1b\\')
  })
})

describe('shouldReuseNativeImagePaint', () => {
  it('reuses an existing paint when protocol, key, size, and position match', () => {
    expect(
      shouldReuseNativeImagePaint(
        {
          protocol: 'kitty',
          paintKey: 'img:a',
          row: 5,
          col: 3,
          widthCells: 16,
          heightCells: 8,
        },
        {
          protocol: 'kitty',
          paintKey: 'img:a',
          row: 5,
          col: 3,
          widthCells: 16,
          heightCells: 8,
        },
      ),
    ).toBe(true)
  })

  it('forces a redraw when any of the placement identity changes', () => {
    expect(
      shouldReuseNativeImagePaint(
        {
          protocol: 'kitty',
          paintKey: 'img:a',
          row: 5,
          col: 3,
          widthCells: 16,
          heightCells: 8,
        },
        {
          protocol: 'kitty',
          paintKey: 'img:b',
          row: 5,
          col: 3,
          widthCells: 16,
          heightCells: 8,
        },
      ),
    ).toBe(false)
    expect(
      shouldReuseNativeImagePaint(
        {
          protocol: 'kitty',
          paintKey: 'img:a',
          row: 5,
          col: 3,
          widthCells: 16,
          heightCells: 8,
        },
        {
          protocol: 'kitty',
          paintKey: 'img:a',
          row: 6,
          col: 3,
          widthCells: 16,
          heightCells: 8,
        },
      ),
    ).toBe(false)
  })
})

describe('runAfterInkRenderForElement', () => {
  it('registers native image draws to run after Ink writes the text frame', () => {
    let calls = 0
    const root: {
      nodeName: string
      onRender: () => void
      afterRenderCallbacks?: Set<() => void>
    } = {
      nodeName: 'ink-root',
      onRender: () => {
        calls += 1
      },
    }
    const leaf = {
      nodeName: 'ink-box',
      parentNode: root,
    }

    runAfterInkRenderForElement(leaf as never, () => {
      calls += 10
    })

    expect(calls).toBe(1)
    expect(root.afterRenderCallbacks?.size).toBe(1)
    for (const callback of root.afterRenderCallbacks ?? []) callback()
    expect(calls).toBe(11)
  })
})
