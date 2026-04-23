import { describe, expect, test } from 'bun:test'
import { encodeITerm2 } from '../iterm2.js'
import { deleteKittyPlacementAtCell, encodeKitty } from '../kitty.js'

const PNG_1PX = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
])

describe('encodeITerm2', () => {
  test('wraps in OSC 1337 with base64 payload and BEL terminator', () => {
    const out = encodeITerm2(PNG_1PX)
    expect(out.startsWith('\x1b]1337;File=')).toBe(true)
    expect(out.endsWith('\x07')).toBe(true)
    expect(out).toContain('inline=1')
    expect(out).toContain('preserveAspectRatio=1')
    expect(out).toContain(`size=${PNG_1PX.byteLength}`)
  })

  test('includes width/height when provided', () => {
    const out = encodeITerm2(PNG_1PX, { widthCells: 40, heightCells: 20 })
    expect(out).toContain('width=40')
    expect(out).toContain('height=20')
  })

  test('wraps in tmux DCS passthrough when $TMUX is set', () => {
    const saved = process.env.TMUX
    process.env.TMUX = '/tmp/tmux'
    try {
      const out = encodeITerm2(PNG_1PX)
      expect(out.startsWith('\x1bPtmux;\x1b')).toBe(true)
      expect(out.endsWith('\x1b\\')).toBe(true)
    } finally {
      if (saved === undefined) delete process.env.TMUX
      else process.env.TMUX = saved
    }
  })
})

describe('encodeKitty', () => {
  test('single-chunk for small payload', () => {
    const out = encodeKitty(PNG_1PX)
    expect(out.startsWith('\x1b_G')).toBe(true)
    expect(out.endsWith('\x1b\\')).toBe(true)
    expect(out).toContain('a=T')
    expect(out).toContain('f=100')
    expect(out).toContain('q=2')
    expect(out).toContain('C=1')
  })

  test('chunks large payloads with m=1 continuations ending in m=0', () => {
    // Make a 5KB-ish buffer to trigger chunking (CHUNK_SIZE=4096).
    const big = new Uint8Array(6 * 1024).fill(0x41)
    const out = encodeKitty(big)
    // Should contain at least one m=1 and one m=0.
    expect(out).toMatch(/m=1/)
    expect(out).toMatch(/m=0/)
    // The last APC command must have m=0 (final chunk).
    const lastApcIdx = out.lastIndexOf('\x1b_G')
    expect(out.slice(lastApcIdx)).toContain('m=0')
  })

  test('includes rows/cols when provided', () => {
    const out = encodeKitty(PNG_1PX, { widthCells: 40, heightCells: 20 })
    expect(out).toContain('c=40')
    expect(out).toContain('r=20')
  })

  test('builds a placement delete command at a specific cell', () => {
    expect(deleteKittyPlacementAtCell({ row: 3, col: 5 })).toBe(
      '\x1b_Ga=d,d=P,x=5,y=3,q=2\x1b\\',
    )
  })
})
