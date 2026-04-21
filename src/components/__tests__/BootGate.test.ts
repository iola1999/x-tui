import { describe, expect, it } from 'bun:test'
import { bootErrorContent } from '../BootGate.js'

/**
 * The three onboarding panels are the only onboarding x-tui offers, so a
 * copy regression would be pretty user-hostile ("the CLI missing screen
 * is now blank"). These tests pin the shape — specific hints might
 * evolve, but each kind must always produce a title, at least one body
 * line, and a retry hint.
 */
describe('bootErrorContent', () => {
  it('cliMissing mentions installation', () => {
    const c = bootErrorContent({ kind: 'cliMissing', message: '' })
    expect(c.title.toLowerCase()).toContain('not found')
    expect(c.body.some(l => /install|uv tool|pipx|brew/i.test(l))).toBe(true)
    expect(c.retryHint).toMatch(/ctrl\+r/i)
  })

  it('notLoggedIn mentions auth login', () => {
    const c = bootErrorContent({ kind: 'notLoggedIn', message: '' })
    expect(c.title.toLowerCase()).toContain('signed in')
    expect(c.body.some(l => /twitter auth login/i.test(l))).toBe(true)
    expect(c.retryHint).toMatch(/ctrl\+r/i)
  })

  it('other surfaces the underlying message', () => {
    const c = bootErrorContent({ kind: 'other', message: 'rate limit exceeded' })
    expect(c.body.some(l => l.includes('rate limit exceeded'))).toBe(true)
    expect(c.retryHint).toMatch(/retry/i)
  })

  it('other handles an empty message without going blank', () => {
    const c = bootErrorContent({ kind: 'other', message: '' })
    expect(c.body.length).toBeGreaterThan(0)
    expect(c.body[0]!.length).toBeGreaterThan(0)
  })

  it('every kind returns non-empty title + body + retry hint', () => {
    for (const kind of ['cliMissing', 'notLoggedIn', 'other'] as const) {
      const c = bootErrorContent({ kind, message: 'x' })
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.body.length).toBeGreaterThan(0)
      expect(c.retryHint.length).toBeGreaterThan(0)
    }
  })
})
