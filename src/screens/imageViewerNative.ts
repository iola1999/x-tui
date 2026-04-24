import type { DOMElement } from '@anthropic/ink'
import {
  nodeCache,
  scheduleAfterRenderFrom,
  subscribeAfterEveryRenderFrom,
} from '@anthropic/ink'
import { appendFileSync } from 'node:fs'
import sharp from 'sharp'
import { encodeITerm2 } from '../utils/imageEncoders/iterm2.js'
import { deleteKittyPlacementAtCell, encodeKitty } from '../utils/imageEncoders/kitty.js'
import type { ImageProtocol } from '../utils/terminalCaps.js'

export type ImageViewerMode = 'native' | 'halfblock'
export type NativeImageProtocol = Extract<ImageProtocol, 'iterm2' | 'kitty'>
export type NativeImagePaintedState = {
  protocol: NativeImageProtocol
  paintKey: string
  row: number
  col: number
  widthCells: number
  heightCells: number
}

const CELL_ASPECT = 2
const H_PADDING = 8
const TOP_CHROME_ROWS = 4
const BOTTOM_CHROME_ROWS = 4
const NATIVE_IMAGE_DEBUG_LOG = '/tmp/x-tui-native-images.log'

type NativeImageDebugValue = boolean | number | string | undefined

export function resolveImageViewerMode(protocol: ImageProtocol): ImageViewerMode {
  return resolveNativeImageProtocol(protocol) ? 'native' : 'halfblock'
}

export function resolveNativeImageProtocol(
  protocol: ImageProtocol,
): NativeImageProtocol | null {
  return protocol === 'iterm2' || protocol === 'kitty' ? protocol : null
}

export async function buildNativeImageSequence(
  protocol: NativeImageProtocol,
  imageBytes: Uint8Array,
  opts: { widthCells: number; heightCells: number; name?: string },
): Promise<string> {
  debugNativeImage('encode-sequence', {
    protocol,
    widthCells: opts.widthCells,
    heightCells: opts.heightCells,
    name: opts.name,
    bytes: imageBytes.byteLength,
  })

  if (protocol === 'kitty') {
    const pngBytes = new Uint8Array(
      await sharp(imageBytes, { failOn: 'none' }).png().toBuffer(),
    )
    return encodeKitty(pngBytes, {
      widthCells: opts.widthCells,
      heightCells: opts.heightCells,
    })
  }

  return encodeITerm2(imageBytes, {
    widthCells: opts.widthCells,
    heightCells: opts.heightCells,
    name: opts.name,
  })
}

export function buildNativeImageClearSequence(
  protocol: NativeImageProtocol,
  opts: {
  row: number
  col: number
  widthCells: number
  heightCells: number
  },
): string {
  if (protocol === 'kitty') {
    return deleteKittyPlacementAtCell({ row: opts.row, col: opts.col })
  }

  const width = Math.max(1, opts.widthCells)
  const height = Math.max(1, opts.heightCells)
  const blankLine = ' '.repeat(width)
  const parts = ['\x1b7']

  for (let offset = 0; offset < height; offset += 1) {
    parts.push(`\x1b[${opts.row + offset};${opts.col}H${blankLine}`)
  }

  parts.push('\x1b8')
  return parts.join('')
}

export function runAfterInkRenderForElement(el: DOMElement, cb: () => void): void {
  scheduleAfterRenderFrom(el, cb)
}

export function subscribeAfterEveryInkRenderForElement(
  el: DOMElement,
  cb: () => void,
): () => void {
  return subscribeAfterEveryRenderFrom(el, cb)
}

function nativeImageDebugEnabled(): boolean {
  const value = process.env.X_TUI_DEBUG_NATIVE_IMAGES?.toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export function debugNativeImage(
  event: string,
  details: Record<string, NativeImageDebugValue>,
): void {
  if (!nativeImageDebugEnabled()) return

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...details,
  })

  try {
    appendFileSync(NATIVE_IMAGE_DEBUG_LOG, `${line}\n`)
  } catch {
    // Debug logging must never break rendering.
  }
}

export function describeNativeImageElement(el: DOMElement): Record<string, NativeImageDebugValue> {
  const ownCache = nodeCache.get(el)
  const parts: string[] = []
  let parent = el.parentNode
  let depth = 0

  while (parent && depth < 8) {
    const yoga = parent.yogaNode
    const cache = nodeCache.get(parent)
    parts.push(
      [
        depth,
        parent.nodeName,
        `yt=${yoga?.getComputedTop() ?? 'na'}`,
        `yl=${yoga?.getComputedLeft() ?? 'na'}`,
        `yh=${yoga?.getComputedHeight() ?? 'na'}`,
        `st=${parent.scrollTop ?? 'na'}`,
        `rst=${parent.renderedScrollTop ?? 'na'}`,
        `c=${cache ? `${cache.x},${cache.y},${cache.width},${cache.height}` : 'na'}`,
      ].join(':'),
    )
    parent = parent.parentNode
    depth += 1
  }

  return {
    ownYogaTop: el.yogaNode?.getComputedTop(),
    ownYogaLeft: el.yogaNode?.getComputedLeft(),
    ownYogaWidth: el.yogaNode?.getComputedWidth(),
    ownYogaHeight: el.yogaNode?.getComputedHeight(),
    ownCacheX: ownCache?.x,
    ownCacheY: ownCache?.y,
    ownCacheWidth: ownCache?.width,
    ownCacheHeight: ownCache?.height,
    parentChain: parts.join('|'),
  }
}

export function fitImageCellsIntoBox(opts: {
  maxCols: number
  maxRows: number
  imageWidth: number
  imageHeight: number
}): {
  widthCells: number
  heightCells: number
} {
  const maxCols = Math.max(1, opts.maxCols)
  const maxRows = Math.max(1, opts.maxRows)
  const imageWidth = Math.max(1, opts.imageWidth)
  const imageHeight = Math.max(1, opts.imageHeight)
  const imageAspect = imageWidth / imageHeight
  const boxAspect = maxCols / (maxRows * CELL_ASPECT)

  let widthCells: number
  let heightCells: number

  if (imageAspect >= boxAspect) {
    widthCells = maxCols
    heightCells = Math.max(1, Math.round(widthCells / imageAspect / CELL_ASPECT))
  } else {
    heightCells = maxRows
    widthCells = Math.max(1, Math.round(heightCells * imageAspect * CELL_ASPECT))
  }

  return {
    widthCells: Math.min(maxCols, widthCells),
    heightCells: Math.min(maxRows, heightCells),
  }
}

export function shouldReuseNativeImagePaint(
  painted: NativeImagePaintedState | null,
  next: NativeImagePaintedState,
): boolean {
  return !!painted &&
    painted.protocol === next.protocol &&
    painted.paintKey === next.paintKey &&
    painted.row === next.row &&
    painted.col === next.col &&
    painted.widthCells === next.widthCells &&
    painted.heightCells === next.heightCells
}

export function fitNativeImageBox(opts: {
  columns: number
  rows: number
  imageWidth: number
  imageHeight: number
}): {
  row: number
  col: number
  widthCells: number
  heightCells: number
} {
  const columns = Math.max(8, opts.columns)
  const rows = Math.max(6, opts.rows)
  const maxCols = Math.max(8, columns - H_PADDING)
  const maxRows = Math.max(4, rows - TOP_CHROME_ROWS - BOTTOM_CHROME_ROWS)
  const { widthCells, heightCells } = fitImageCellsIntoBox({
    maxCols,
    maxRows,
    imageWidth: opts.imageWidth,
    imageHeight: opts.imageHeight,
  })

  const col = 5 + Math.floor((maxCols - widthCells) / 2)
  const row = TOP_CHROME_ROWS + Math.floor((maxRows - heightCells) / 2)

  return { row, col, widthCells, heightCells }
}

export function measureNativeImageCellOrigin(el: DOMElement): {
  row: number
  col: number
} {
  let top = el.yogaNode?.getComputedTop() ?? 0
  let left = el.yogaNode?.getComputedLeft() ?? 0
  let parent = el.parentNode

  while (parent) {
    if (parent.yogaNode) {
      top += parent.yogaNode.getComputedTop()
      left += parent.yogaNode.getComputedLeft()
    }
    const scrollTop = parent.renderedScrollTop ?? parent.scrollTop
    if (scrollTop) top -= scrollTop
    parent = parent.parentNode
  }

  return {
    row: top + 1,
    col: left + 1,
  }
}

export function measureNativeImagePlacement(
  el: DOMElement,
  terminalRows: number,
): {
  row: number
  col: number
  height: number
  visible: boolean
} {
  let top = el.yogaNode?.getComputedTop() ?? 0
  let left = el.yogaNode?.getComputedLeft() ?? 0
  const height = Math.max(1, el.yogaNode?.getComputedHeight() ?? 0)
  let parent = el.parentNode

  while (parent) {
    if (parent.yogaNode) {
      top += parent.yogaNode.getComputedTop()
      left += parent.yogaNode.getComputedLeft()
    }
    const scrollTop = parent.renderedScrollTop ?? parent.scrollTop
    if (scrollTop) top -= scrollTop
    parent = parent.parentNode
  }

  const visible = top >= 0 && top + height <= terminalRows

  return {
    row: top + 1,
    col: left + 1,
    height,
    visible,
  }
}
