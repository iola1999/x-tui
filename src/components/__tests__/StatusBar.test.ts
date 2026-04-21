import { describe, expect, it } from 'bun:test'
import { screenHintsFor, screenLabelFor } from '../StatusBar.js'
import type { Screen } from '../../state/store.js'

/**
 * Cheap pure-function pins for the status bar contract. These aren't
 * "ergonomic test" — they're a guard: if someone adds a new Screen kind
 * to the union, the switch-over-kind returns a sensible default instead
 * of an unlabeled blank. Since these strings are what the user sees every
 * second of interaction, a typo regression is obvious and worth catching.
 */
describe('StatusBar helpers', () => {
  const cases: Screen[] = [
    { kind: 'feed' },
    { kind: 'search' },
    { kind: 'bookmarks' },
    { kind: 'profile' },
    { kind: 'profile', handle: 'alice' },
    { kind: 'tweet', id: 'abc' },
    { kind: 'imageViewer', urls: ['a', 'b'], index: 0 },
    { kind: 'compose', mode: { kind: 'new' } },
    { kind: 'compose', mode: { kind: 'reply', inReplyTo: { id: 'x', text: '', author: 'alice' } } },
    { kind: 'compose', mode: { kind: 'quote', quoted: { id: 'y', text: '', author: 'bob' } } },
    { kind: 'help' },
  ]

  it('screenLabelFor produces a non-empty string for every Screen variant', () => {
    for (const s of cases) {
      const label = screenLabelFor(s)
      expect(label.length > 0).toBe(true)
    }
  })

  it('screenLabelFor includes the handle for profile screens', () => {
    expect(screenLabelFor({ kind: 'profile', handle: 'alice' })).toBe('@alice')
    expect(screenLabelFor({ kind: 'profile' })).toBe('Profile')
  })

  it('screenLabelFor identifies reply and quote compose modes', () => {
    expect(
      screenLabelFor({
        kind: 'compose',
        mode: { kind: 'reply', inReplyTo: { id: 'x', text: '', author: 'alice' } },
      }),
    ).toBe('Reply to @alice')
    expect(
      screenLabelFor({
        kind: 'compose',
        mode: { kind: 'quote', quoted: { id: 'y', text: '', author: 'bob' } },
      }),
    ).toBe('Quote @bob')
  })

  it('screenHintsFor uses compose hints in compose, image hints in viewer', () => {
    expect(screenHintsFor({ kind: 'compose', mode: { kind: 'new' } })).toContain('send')
    expect(screenHintsFor({ kind: 'imageViewer', urls: ['a'], index: 0 })).toContain('prev')
  })

  it('screenHintsFor falls back to global hints for list screens', () => {
    expect(screenHintsFor({ kind: 'feed' })).toContain('quit')
    expect(screenHintsFor({ kind: 'search' })).toContain('quit')
    expect(screenHintsFor({ kind: 'bookmarks' })).toContain('quit')
  })
})
