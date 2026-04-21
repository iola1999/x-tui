import { describe, expect, test } from 'bun:test'
import { getTerminalCaps, resetTerminalCapsForTesting } from '../terminalCaps.js'

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {}
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k]
    if (env[k] === undefined) delete process.env[k]
    else process.env[k] = env[k]
  }
  resetTerminalCapsForTesting()
  try {
    return fn()
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    resetTerminalCapsForTesting()
  }
}

describe('getTerminalCaps', () => {
  test('iTerm2 detection via TERM_PROGRAM', () => {
    withEnv(
      {
        TERM_PROGRAM: 'iTerm.app',
        TERM: 'xterm-256color',
        ITERM_SESSION_ID: undefined,
        KITTY_WINDOW_ID: undefined,
        X_TUI_IMAGE_PROTOCOL: undefined,
      },
      () => {
        const caps = getTerminalCaps()
        expect(caps.protocol).toBe('iterm2')
        expect(caps.trueColor).toBe(true)
      },
    )
  })

  test('Kitty via TERM', () => {
    withEnv(
      {
        TERM: 'xterm-kitty',
        TERM_PROGRAM: undefined,
        ITERM_SESSION_ID: undefined,
        X_TUI_IMAGE_PROTOCOL: undefined,
      },
      () => {
        const caps = getTerminalCaps()
        expect(caps.protocol).toBe('kitty')
      },
    )
  })

  test('Ghostty via TERM', () => {
    withEnv(
      {
        TERM: 'xterm-ghostty',
        TERM_PROGRAM: undefined,
        ITERM_SESSION_ID: undefined,
        X_TUI_IMAGE_PROTOCOL: undefined,
      },
      () => {
        expect(getTerminalCaps().protocol).toBe('kitty')
      },
    )
  })

  test('Apple Terminal falls back to halfblock', () => {
    withEnv(
      {
        TERM_PROGRAM: 'Apple_Terminal',
        TERM: 'xterm-256color',
        ITERM_SESSION_ID: undefined,
        KITTY_WINDOW_ID: undefined,
        X_TUI_IMAGE_PROTOCOL: undefined,
        X_TUI_ASSUME_SIXEL: undefined,
        COLORTERM: undefined,
      },
      () => {
        const caps = getTerminalCaps()
        expect(caps.protocol).toBe('halfblock')
        expect(caps.trueColor).toBe(false)
      },
    )
  })

  test('X_TUI_IMAGE_PROTOCOL forces override', () => {
    withEnv(
      {
        X_TUI_IMAGE_PROTOCOL: 'halfblock',
        TERM_PROGRAM: 'iTerm.app',
      },
      () => {
        expect(getTerminalCaps().protocol).toBe('halfblock')
      },
    )
  })

  test('X_TUI_ASSUME_SIXEL=1 picks sixel when no better option', () => {
    withEnv(
      {
        X_TUI_ASSUME_SIXEL: '1',
        TERM_PROGRAM: undefined,
        TERM: 'mlterm',
        ITERM_SESSION_ID: undefined,
        KITTY_WINDOW_ID: undefined,
        X_TUI_IMAGE_PROTOCOL: undefined,
      },
      () => {
        expect(getTerminalCaps().protocol).toBe('sixel')
      },
    )
  })

  test('COLORTERM=truecolor enables trueColor even on dumb term', () => {
    withEnv(
      {
        TERM_PROGRAM: 'tmux',
        COLORTERM: 'truecolor',
        TERM: 'tmux-256color',
        ITERM_SESSION_ID: undefined,
        KITTY_WINDOW_ID: undefined,
        X_TUI_IMAGE_PROTOCOL: undefined,
      },
      () => {
        expect(getTerminalCaps().trueColor).toBe(true)
      },
    )
  })
})
