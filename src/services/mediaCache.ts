import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { fetch } from 'undici'

const CACHE_DIR = process.env.X_TUI_CACHE_DIR ?? join(homedir(), '.cache', 'x-tui', 'media')

async function ensureDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
}

function keyFor(url: string): string {
  const ext = extname(new URL(url).pathname).split('?')[0] || ''
  const h = createHash('sha1').update(url).digest('hex').slice(0, 16)
  return join(CACHE_DIR, `${h}${ext || '.bin'}`)
}

/**
 * Fetch media (image) from URL, caching to `~/.cache/x-tui/media/<sha1>.<ext>`.
 * Returns the local file path on success. Concurrent requests for the same URL
 * are coalesced through an in-flight map so we don't download twice.
 */
const inflight = new Map<string, Promise<string>>()

export async function getMediaPath(url: string): Promise<string> {
  const existing = inflight.get(url)
  if (existing) return existing
  const p = (async () => {
    await ensureDir()
    const dest = keyFor(url)
    try {
      const st = await stat(dest)
      if (st.isFile() && st.size > 0) return dest
    } catch {
      // miss
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'x-tui/0.1' },
      redirect: 'follow',
    })
    if (!res.ok) {
      throw new Error(`fetch ${url} → ${res.status}`)
    }
    const ab = await res.arrayBuffer()
    await writeFile(dest, Buffer.from(ab))
    return dest
  })()
  inflight.set(url, p)
  try {
    return await p
  } finally {
    inflight.delete(url)
  }
}

/** Read a cached/downloaded media file into a Buffer. */
export async function getMediaBuffer(url: string): Promise<Buffer> {
  const path = await getMediaPath(url)
  return readFile(path)
}
