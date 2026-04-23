/**
 * Kitty graphics protocol.
 * https://sw.kovidgoyal.net/kitty/graphics-protocol/
 *
 * Supported by Kitty and Ghostty. We use the simple "transmit + display
 * immediately" path (a=T) with PNG format (f=100). Data is chunked at 4096
 * base64 bytes per APC escape.
 */

const CHUNK_SIZE = 4096
const ESC = '\x1b'

function maybeTmuxWrap(body: string): string {
  if (process.env.TMUX) {
    const escaped = body.replaceAll(ESC, `${ESC}${ESC}`)
    return `${ESC}Ptmux;${ESC}${escaped}${ESC}\\`
  }
  return body
}

export function encodeKitty(
  pngBytes: Uint8Array,
  opts: { widthCells?: number; heightCells?: number } = {},
): string {
  const base64 = Buffer.from(pngBytes).toString('base64')
  const head: string[] = ['a=T', 'f=100', 'q=2', 'C=1']
  if (opts.widthCells) head.push(`c=${opts.widthCells}`)
  if (opts.heightCells) head.push(`r=${opts.heightCells}`)

  if (base64.length <= CHUNK_SIZE) {
    return maybeTmuxWrap(`\x1b_G${head.join(',')};${base64}\x1b\\`)
  }

  const parts: string[] = []
  let offset = 0
  let first = true
  while (offset < base64.length) {
    const chunk = base64.slice(offset, offset + CHUNK_SIZE)
    offset += CHUNK_SIZE
    const more = offset < base64.length ? 1 : 0
    if (first) {
      parts.push(`\x1b_G${head.join(',')},m=${more};${chunk}\x1b\\`)
      first = false
    } else {
      parts.push(`\x1b_Gm=${more};${chunk}\x1b\\`)
    }
  }
  return maybeTmuxWrap(parts.join(''))
}

export function deleteKittyPlacementAtCell(opts: {
  row: number
  col: number
}): string {
  return maybeTmuxWrap(`\x1b_Ga=d,d=P,x=${opts.col},y=${opts.row},q=2\x1b\\`)
}
