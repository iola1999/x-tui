import sharp from 'sharp'

/**
 * Render an RGB(A) image buffer as halfblock ANSI lines.
 *
 * Each terminal row encodes TWO image rows: the upper pixel becomes the cell's
 * foreground and the lower pixel becomes the background, with the glyph `▀`
 * (upper-half block). Transparent / alpha=0 pixels are emitted as a space
 * with just the bg, so empty areas don't paint the fg unexpectedly.
 *
 * The producer guarantees `lines.length === ceil(rows/2)` and each line has
 * exactly `cols` wide cells, so Yoga (via <RawAnsi width height/>) sizes the
 * leaf correctly.
 */
export async function renderHalfblock(
  imageBuffer: Uint8Array,
  opts: { cols: number; maxRows: number },
): Promise<{ lines: string[]; width: number; height: number }> {
  const { cols, maxRows } = opts
  // Two vertical pixels per terminal row; we target `maxRows * 2` pixel rows.
  const img = sharp(imageBuffer, { failOn: 'none' })
  const meta = await img.metadata()
  const srcW = meta.width ?? cols
  const srcH = meta.height ?? maxRows * 2
  const targetW = cols
  const aspect = srcH / Math.max(1, srcW)
  let targetRowsPixels = Math.round(targetW * aspect)
  const maxRowsPixels = maxRows * 2
  if (targetRowsPixels > maxRowsPixels) targetRowsPixels = maxRowsPixels
  // Ensure even number of pixel rows so each terminal row has upper+lower.
  if (targetRowsPixels % 2 !== 0) targetRowsPixels -= 1
  if (targetRowsPixels < 2) targetRowsPixels = 2

  const { data, info } = await img
    .resize(targetW, targetRowsPixels, { fit: 'contain', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels
  const w = info.width
  const h = info.height
  const lines: string[] = []
  for (let y = 0; y < h; y += 2) {
    let row = ''
    for (let x = 0; x < w; x++) {
      const iUp = (y * w + x) * channels
      const iDn = ((y + 1) * w + x) * channels
      const uR = data[iUp] ?? 0
      const uG = data[iUp + 1] ?? 0
      const uB = data[iUp + 2] ?? 0
      const uA = channels === 4 ? data[iUp + 3] ?? 255 : 255
      const dR = data[iDn] ?? 0
      const dG = data[iDn + 1] ?? 0
      const dB = data[iDn + 2] ?? 0
      const dA = channels === 4 ? data[iDn + 3] ?? 255 : 255

      if (uA < 16 && dA < 16) {
        // Transparent cell — emit a plain space (reset any active style).
        row += '\x1b[0m '
      } else if (uA < 16) {
        // Upper half invisible → flip to lower half block.
        row += `\x1b[49;38;2;${dR};${dG};${dB}m▄`
      } else if (dA < 16) {
        row += `\x1b[49;38;2;${uR};${uG};${uB}m▀`
      } else {
        row += `\x1b[38;2;${uR};${uG};${uB};48;2;${dR};${dG};${dB}m▀`
      }
    }
    row += '\x1b[0m'
    lines.push(row)
  }
  return { lines, width: w, height: Math.ceil(h / 2) }
}
