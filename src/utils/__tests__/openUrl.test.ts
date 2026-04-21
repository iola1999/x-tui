import { describe, expect, test } from 'bun:test'
import { isOpenable } from '../openUrl.js'

/**
 * Regression guard: OSC 8 link payloads are attacker-controlled (anything
 * in a tweet body). `openUrl` must never hand non-web schemes to the OS
 * — `mailto:`, `javascript:`, `file://`, custom-scheme handlers, etc.
 * If someone ever "relaxes" the predicate, these tests scream.
 */
describe('isOpenable', () => {
  test('accepts http(s) URLs, case-insensitive scheme', () => {
    expect(isOpenable('https://example.com')).toBe(true)
    expect(isOpenable('http://example.com/path?q=1')).toBe(true)
    expect(isOpenable('HTTPS://Example.Com')).toBe(true)
  })

  test('rejects non-web schemes', () => {
    const rejects = [
      'mailto:hi@example.com',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,<script>…',
      'ssh://user@host',
      '',
      'example.com',
      '   https://leading-space.com',
    ]
    for (const url of rejects) {
      expect(isOpenable(url)).toBe(false)
    }
  })
})
