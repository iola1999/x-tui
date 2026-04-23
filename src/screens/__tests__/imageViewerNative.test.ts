import { describe, expect, it } from 'bun:test'
import {
  fitNativeImageBox,
  resolveImageViewerMode,
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

describe('fitNativeImageBox', () => {
  it('fits a wide image inside the centered viewer bounds', () => {
    const box = fitNativeImageBox({
      columns: 100,
      rows: 30,
      imageWidth: 1600,
      imageHeight: 900,
    })

    expect(box.widthCells).toBe(96)
    expect(box.heightCells).toBe(27)
    expect(box.col).toBe(3)
    expect(box.row).toBe(3)
  })

  it('fits a tall image without exceeding the available terminal body', () => {
    const box = fitNativeImageBox({
      columns: 100,
      rows: 30,
      imageWidth: 900,
      imageHeight: 1600,
    })

    expect(box.widthCells).toBe(30)
    expect(box.heightCells).toBe(27)
    expect(box.col).toBe(36)
    expect(box.row).toBe(3)
  })
})
