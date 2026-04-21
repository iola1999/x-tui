/**
 * Detect which inline-image protocols the current terminal supports.
 *
 * Cheap env-var checks only — we intentionally do NOT probe with DA1 / DA2
 * queries on startup (they require raw-mode stdin with a timed read and
 * would race with Ink's own terminal-querier). If we later want Sixel
 * detection we can gate it on env hints + a one-shot probe.
 */

export type ImageProtocol = 'iterm2' | 'kitty' | 'sixel' | 'halfblock'

export type TerminalCaps = {
  /** Best available protocol for high-fidelity rendering. */
  protocol: ImageProtocol
  /** True-color (24-bit) support — halfblock still looks fine in 256-color. */
  trueColor: boolean
  /** Whether the terminal reliably renders emoji at width=2. */
  emojiWide: boolean
}

function envTruthy(v: string | undefined): boolean {
  return !!v && /^(1|true|yes|on)$/i.test(v)
}

function envForced(): ImageProtocol | undefined {
  const v = process.env.X_TUI_IMAGE_PROTOCOL?.toLowerCase()
  if (v === 'iterm2' || v === 'kitty' || v === 'sixel' || v === 'halfblock') return v
  return undefined
}

/** Evaluate once; env is stable for the life of the process. */
let cached: TerminalCaps | undefined

export function getTerminalCaps(): TerminalCaps {
  if (cached) return cached
  cached = detect()
  return cached
}

export function resetTerminalCapsForTesting(): void {
  cached = undefined
}

function detect(): TerminalCaps {
  const forced = envForced()
  const term = process.env.TERM ?? ''
  const termProgram = process.env.TERM_PROGRAM ?? ''

  // iTerm2's OSC 1337 inline images. WezTerm re-implements the same protocol.
  const isIterm2 =
    termProgram === 'iTerm.app' ||
    termProgram === 'WezTerm' ||
    !!process.env.ITERM_SESSION_ID

  // Kitty graphics protocol. Ghostty speaks it too.
  const isKitty =
    term === 'xterm-kitty' ||
    term === 'xterm-ghostty' ||
    !!process.env.KITTY_WINDOW_ID ||
    termProgram === 'ghostty'

  // Sixel: a handful of terminals (mlterm, foot, xterm -ti vt340, WezTerm with
  // config). env-sniffing is unreliable; opt-in via env var only.
  const hasSixel = envTruthy(process.env.X_TUI_ASSUME_SIXEL)

  let protocol: ImageProtocol
  if (forced) {
    protocol = forced
  } else if (isKitty) {
    protocol = 'kitty'
  } else if (isIterm2) {
    protocol = 'iterm2'
  } else if (hasSixel) {
    protocol = 'sixel'
  } else {
    protocol = 'halfblock'
  }

  // True color: any terminal that has set COLORTERM=truecolor or 24bit, or any
  // modern one we identified above.
  const colortermTrue = /truecolor|24bit/i.test(process.env.COLORTERM ?? '')
  const trueColor = colortermTrue || isKitty || isIterm2

  const emojiWide =
    termProgram === 'iTerm.app' ||
    termProgram === 'WezTerm' ||
    termProgram === 'ghostty' ||
    isKitty ||
    /^xterm-(kitty|ghostty)|wezterm/.test(term)

  return { protocol, trueColor, emojiWide }
}
