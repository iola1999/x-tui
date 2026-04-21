/**
 * iTerm2 inline image protocol (OSC 1337).
 * https://iterm2.com/documentation-images.html
 *
 * Supported by iTerm2 and WezTerm.
 */

/** Wrap a sequence with tmux DCS passthrough when TERM_PROGRAM=tmux. */
function maybeTmuxWrap(body: string): string {
  if (process.env.TMUX) {
    // ESC P tmux; ESC <body-with-ESC-doubled> ESC \
    const escaped = body.replace(/\x1b/g, '\x1b\x1b')
    return `\x1bPtmux;\x1b${escaped}\x1b\\`
  }
  return body
}

export function encodeITerm2(
  imageBytes: Uint8Array,
  opts: { widthCells?: number; heightCells?: number; name?: string } = {},
): string {
  const base64 = Buffer.from(imageBytes).toString('base64')
  const parts: string[] = ['inline=1', 'preserveAspectRatio=1']
  if (opts.widthCells) parts.push(`width=${opts.widthCells}`)
  if (opts.heightCells) parts.push(`height=${opts.heightCells}`)
  if (opts.name) parts.push(`name=${Buffer.from(opts.name).toString('base64')}`)
  parts.push(`size=${imageBytes.byteLength}`)
  const seq = `\x1b]1337;File=${parts.join(';')}:${base64}\x07`
  return maybeTmuxWrap(seq)
}
