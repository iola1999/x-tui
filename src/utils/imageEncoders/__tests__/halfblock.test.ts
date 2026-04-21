import { describe, expect, test } from 'bun:test'
import sharp from 'sharp'
import { renderHalfblock } from '../halfblock.js'

async function makePng(w: number, h: number, rgb: [number, number, number]): Promise<Uint8Array> {
  const [r, g, b] = rgb
  const raw = Buffer.alloc(w * h * 3)
  for (let i = 0; i < w * h; i++) {
    raw[i * 3] = r
    raw[i * 3 + 1] = g
    raw[i * 3 + 2] = b
  }
  const buf = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
  return new Uint8Array(buf)
}

describe('renderHalfblock', () => {
  test('produces one row per two pixel rows', async () => {
    const png = await makePng(8, 8, [200, 100, 50])
    const { lines, width, height } = await renderHalfblock(png, { cols: 8, maxRows: 4 })
    expect(lines).toHaveLength(4)
    expect(width).toBe(8)
    expect(height).toBe(4)
  })

  test('each line contains `cols` ▀ glyphs', async () => {
    const png = await makePng(4, 4, [255, 0, 0])
    const { lines } = await renderHalfblock(png, { cols: 4, maxRows: 2 })
    for (const line of lines) {
      // Strip ANSI, count ▀ glyphs.
      const stripped = line.replace(/\x1b\[[0-9;]*m/g, '')
      // Solid RGB → halfblock should be all ▀ (fg=bg top=bottom).
      const blocks = Array.from(stripped).filter(c => c === '▀').length
      expect(blocks).toBe(4)
    }
  })

  test('solid color emits the same rgb for fg and bg', async () => {
    const png = await makePng(4, 4, [10, 20, 30])
    const { lines } = await renderHalfblock(png, { cols: 4, maxRows: 2 })
    // The first cell of the first line should contain both 38;2;10;20;30 and 48;2;10;20;30.
    const first = lines[0]!
    expect(first).toContain('38;2;10;20;30')
    expect(first).toContain('48;2;10;20;30')
  })

  test('respects maxRows cap', async () => {
    const png = await makePng(20, 200, [0, 0, 0])
    const { lines } = await renderHalfblock(png, { cols: 20, maxRows: 5 })
    expect(lines.length).toBeLessThanOrEqual(5)
  })

  test('ends each line with a reset', async () => {
    const png = await makePng(4, 4, [0, 0, 0])
    const { lines } = await renderHalfblock(png, { cols: 4, maxRows: 2 })
    for (const line of lines) {
      expect(line.endsWith('\x1b[0m')).toBe(true)
    }
  })
})
