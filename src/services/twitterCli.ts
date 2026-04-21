/**
 * Thin wrapper over the `twitter` CLI. Every call spawns the CLI with
 * `--json` and parses its stdout. stderr is preserved for error surfacing.
 *
 * We avoid `execa` to keep dependency surface small — Bun.spawn is enough.
 */
import type {
  FeedResponse,
  Tweet,
  TweetDetailResponse,
  UserResponse,
  WriteResponse,
} from '../types/tweet.js'

const TWITTER_CMD = process.env.X_TUI_TWITTER_CMD ?? 'twitter'

export class TwitterCliError extends Error {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
  readonly args: string[]
  readonly authMissing: boolean
  constructor(opts: { message: string; exitCode: number; stderr: string; stdout: string; args: string[] }) {
    super(opts.message)
    this.name = 'TwitterCliError'
    this.exitCode = opts.exitCode
    this.stderr = opts.stderr
    this.stdout = opts.stdout
    this.args = opts.args
    this.authMissing =
      /not (?:logged|authenticated)|unauthenti|401|no session/i.test(opts.stderr) ||
      /not (?:logged|authenticated)|no session/i.test(opts.stdout)
  }
}

async function readAll(stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> {
  if (!stream) return ''
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const merged = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    merged.set(c, off)
    off += c.length
  }
  return new TextDecoder().decode(merged)
}

/**
 * Spawn `twitter` with the given args (plus a guaranteed `--json`). Returns
 * parsed JSON of type T. Throws TwitterCliError for non-zero exits or parse
 * failures.
 */
export async function runTwitter<T>(
  args: string[],
  opts: { timeout?: number } = {},
): Promise<T> {
  const finalArgs = args.includes('--json') ? args : [...args, '--json']
  const proc = Bun.spawn({
    cmd: [TWITTER_CMD, ...finalArgs],
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NO_COLOR: '1' },
  })

  let killTimer: ReturnType<typeof setTimeout> | undefined
  if (opts.timeout) {
    killTimer = setTimeout(() => {
      try {
        proc.kill('SIGTERM')
      } catch {
        // best-effort
      }
    }, opts.timeout)
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    readAll(proc.stdout as ReadableStream<Uint8Array>),
    readAll(proc.stderr as ReadableStream<Uint8Array>),
    proc.exited,
  ])
  if (killTimer) clearTimeout(killTimer)

  if (exitCode !== 0) {
    throw new TwitterCliError({
      message: `twitter ${finalArgs.join(' ')} exited ${exitCode}`,
      exitCode,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      args: finalArgs,
    })
  }

  try {
    return JSON.parse(stdout) as T
  } catch (err) {
    throw new TwitterCliError({
      message: `twitter ${finalArgs.join(' ')} produced non-JSON output: ${(err as Error).message}`,
      exitCode: 0,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      args: finalArgs,
    })
  }
}

// -- High-level API wrappers --------------------------------------------------

export async function whoami(): Promise<UserResponse['data']['user']> {
  const res = await runTwitter<UserResponse>(['whoami'])
  if (!res.ok) throw new Error(res.error ?? 'whoami failed')
  return res.data.user
}

function pickNextCursor(r: FeedResponse): string | undefined {
  return r.nextCursor ?? r.next_cursor ?? r.cursor
}

export async function feed(
  opts: { cursor?: string; max?: number; fullText?: boolean } = {},
): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
  const args = ['feed']
  if (opts.max) args.push('--max', String(opts.max))
  if (opts.cursor) args.push('--cursor', opts.cursor)
  if (opts.fullText) args.push('--full-text')
  const r = await runTwitter<FeedResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'feed failed')
  return { tweets: r.data, nextCursor: pickNextCursor(r) }
}

export async function search(
  query: string,
  opts: {
    tab?: 'Top' | 'Latest'
    max?: number
    cursor?: string
    from?: string
    lang?: string
    since?: string
    until?: string
    hasImages?: boolean
    hasLinks?: boolean
    excludeRetweets?: boolean
    filter?: boolean
    fullText?: boolean
  } = {},
): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
  const args = ['search', query]
  if (opts.tab) args.push('-t', opts.tab)
  if (opts.max) args.push('--max', String(opts.max))
  if (opts.cursor) args.push('--cursor', opts.cursor)
  if (opts.from) args.push('--from', opts.from)
  if (opts.lang) args.push('--lang', opts.lang)
  if (opts.since) args.push('--since', opts.since)
  if (opts.until) args.push('--until', opts.until)
  if (opts.hasImages) args.push('--has', 'images')
  if (opts.hasLinks) args.push('--has', 'links')
  if (opts.excludeRetweets) args.push('--exclude', 'retweets')
  if (opts.filter) args.push('--filter')
  if (opts.fullText) args.push('--full-text')
  const r = await runTwitter<FeedResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'search failed')
  return { tweets: r.data, nextCursor: pickNextCursor(r) }
}

/**
 * Normalize `twitter tweet <id> --json`'s `data` field into
 * `{ tweet, replies }`. twitter-cli 0.8 returns `data` as an array of tweets
 * with the requested one at index 0 and the thread replies after. Older drafts
 * used `{tweet, replies}`; we accept both to stay compatible.
 *
 * Exported purely for testing — the CLI wrapper is the real caller.
 */
export function pickTweetDetail(data: unknown, id: string): { tweet: Tweet; replies: Tweet[] } {
  if (Array.isArray(data)) {
    const [tweet, ...replies] = data as Tweet[]
    if (!tweet || !tweet.id) throw new Error(`tweet ${id} not found`)
    return { tweet, replies }
  }
  if (data && typeof data === 'object' && 'tweet' in data) {
    const d = data as { tweet?: Tweet; replies?: Tweet[] }
    if (!d.tweet || !d.tweet.id) throw new Error(`tweet ${id} not found`)
    return { tweet: d.tweet, replies: d.replies ?? [] }
  }
  throw new Error(`tweet ${id} not found`)
}

export async function tweetDetail(
  id: string,
  opts: { fullText?: boolean } = {},
): Promise<{ tweet: Tweet; replies: Tweet[] }> {
  const args = ['tweet', id]
  if (opts.fullText) args.push('--full-text')
  const r = await runTwitter<TweetDetailResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'tweet failed')
  return pickTweetDetail(r.data, id)
}

export async function bookmarks(
  opts: { max?: number; cursor?: string; fullText?: boolean } = {},
): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
  const args = ['bookmarks']
  if (opts.max) args.push('--max', String(opts.max))
  if (opts.cursor) args.push('--cursor', opts.cursor)
  if (opts.fullText) args.push('--full-text')
  const r = await runTwitter<FeedResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'bookmarks failed')
  return { tweets: r.data, nextCursor: pickNextCursor(r) }
}

export async function userProfile(handle: string): Promise<UserResponse['data']['user']> {
  const r = await runTwitter<UserResponse>(['user', handle.replace(/^@/, '')])
  if (!r.ok) throw new Error(r.error ?? 'user failed')
  return r.data.user
}

export async function userPosts(
  handle: string,
  opts: { max?: number; cursor?: string; fullText?: boolean } = {},
): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
  const args = ['user-posts', handle.replace(/^@/, '')]
  if (opts.max) args.push('--max', String(opts.max))
  if (opts.cursor) args.push('--cursor', opts.cursor)
  if (opts.fullText) args.push('--full-text')
  const r = await runTwitter<FeedResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'user-posts failed')
  return { tweets: r.data, nextCursor: pickNextCursor(r) }
}

// -- Write operations (Phase 7 will wire keybindings to these) ---------------

export async function like(id: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['like', id])
  if (!r.ok) throw new Error(r.error ?? 'like failed')
}

export async function unlike(id: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['unlike', id])
  if (!r.ok) throw new Error(r.error ?? 'unlike failed')
}

export async function retweet(id: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['retweet', id])
  if (!r.ok) throw new Error(r.error ?? 'retweet failed')
}

export async function unretweet(id: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['unretweet', id])
  if (!r.ok) throw new Error(r.error ?? 'unretweet failed')
}

export async function bookmark(id: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['bookmark', id])
  if (!r.ok) throw new Error(r.error ?? 'bookmark failed')
}

export async function unbookmark(id: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['unbookmark', id])
  if (!r.ok) throw new Error(r.error ?? 'unbookmark failed')
}

export async function follow(handle: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['follow', handle.replace(/^@/, '')])
  if (!r.ok) throw new Error(r.error ?? 'follow failed')
}

export async function unfollow(handle: string): Promise<void> {
  const r = await runTwitter<WriteResponse>(['unfollow', handle.replace(/^@/, '')])
  if (!r.ok) throw new Error(r.error ?? 'unfollow failed')
}

export async function postTweet(
  text: string,
  opts: { images?: string[]; replyTo?: string } = {},
): Promise<Tweet> {
  const args = ['post', text]
  if (opts.replyTo) args.push('--reply-to', opts.replyTo)
  for (const img of opts.images ?? []) args.push('-i', img)
  const r = await runTwitter<WriteResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'post failed')
  return r.data as Tweet
}

export async function replyTweet(
  id: string,
  text: string,
  opts: { images?: string[] } = {},
): Promise<Tweet> {
  const args = ['reply', id, text]
  for (const img of opts.images ?? []) args.push('-i', img)
  const r = await runTwitter<WriteResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'reply failed')
  return r.data as Tweet
}

export async function quoteTweet(
  id: string,
  text: string,
  opts: { images?: string[] } = {},
): Promise<Tweet> {
  const args = ['quote', id, text]
  for (const img of opts.images ?? []) args.push('-i', img)
  const r = await runTwitter<WriteResponse>(args)
  if (!r.ok) throw new Error(r.error ?? 'quote failed')
  return r.data as Tweet
}
