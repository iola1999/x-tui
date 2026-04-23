import type { ImageProtocol } from '../utils/terminalCaps.js'

export type ImageViewerMode = 'native' | 'halfblock'

const CELL_ASPECT = 2
const H_PADDING = 2
const TOP_CHROME_ROWS = 3

export function resolveImageViewerMode(protocol: ImageProtocol): ImageViewerMode {
  return protocol === 'iterm2' || protocol === 'kitty' ? 'native' : 'halfblock'
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
  const maxRows = Math.max(4, rows - TOP_CHROME_ROWS)
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

  widthCells = Math.min(maxCols, widthCells)
  heightCells = Math.min(maxRows, heightCells)

  const col = 2 + Math.floor((maxCols - widthCells) / 2)
  const row = 3 + Math.floor((maxRows - heightCells) / 2)

  return { row, col, widthCells, heightCells }
}
