/**
 * Thin wrapper over twitter-cli. By default x-tui prefers a resident
 * `twitter daemon` child process to avoid repeated cold starts, but can
 * fall back to one-shot `twitter ... --json` invocations when needed.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type {
  FeedResponse,
  Tweet,
  TweetDetailResponse,
  UserResponse,
  WriteResponse,
} from '../types/tweet.js'
import {
  TwitterDaemonClient,
  TwitterDaemonRemoteError,
  TwitterDaemonTransportError,
} from './twitterDaemon.js'

type CliFailure = {
  exitCode: number
  args: string[]
  stderr: string
  stdout: string
}

export function resolveTwitterCmd(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
  moduleUrl = import.meta.url,
): string {
  const override = env.X_TUI_TWITTER_CMD?.trim()
  if (override) return override

  const siblingFork = fileURLToPath(new URL('../../../twitter-cli/.venv/bin/twitter', moduleUrl))
  if (exists(siblingFork)) return siblingFork

  return 'twitter'
}

export function describeCliFailure({ exitCode, args, stderr, stdout }: CliFailure): string | null {
  const combined = `${stderr}\n${stdout}`

  if (exitCode === 2 && /No such option:\s+--pages/i.test(combined)) {
    return `Installed twitter CLI is too old and does not support --pages. x-tui needs the forked twitter-cli with page-limit and daemon support. Set X_TUI_TWITTER_CMD to that binary or put it earlier on PATH.`
  }
  if (exitCode === 2 && /No such command ['"]daemon['"]/i.test(combined)) {
    return `Installed twitter CLI is too old and does not support the daemon subcommand. Set X_TUI_TWITTER_CMD to the forked twitter-cli binary or update PATH to use it first.`
  }

  return null
}

const TWITTER_CMD = resolveTwitterCmd()
const TWITTER_TRANSPORT = process.env.X_TUI_TWITTER_TRANSPORT ?? 'daemon'
let daemonClient: TwitterDaemonClient | null = null
let daemonDisabled = TWITTER_TRANSPORT === 'spawn'

/** Classification used by the boot gate + toast surfaces to pick the
 *  right onboarding message. `cliMissing` means the binary wasn't on
 *  PATH; `notLoggedIn` means it ran but reported no session; `other` is
 *  everything else (network, rate-limit, parse errors). */
export type TwitterCliErrorKind = 'cliMissing' | 'notLoggedIn' | 'other'

const AUTH_RE = /not (?:logged|authenticated)|unauthenti|401|no session/i

function classifyKind(opts: {
  enoent?: boolean
  stderr: string
  stdout: string
}): TwitterCliErrorKind {
  if (opts.enoent) return 'cliMissing'
  if (AUTH_RE.test(opts.stderr) || AUTH_RE.test(opts.stdout)) return 'notLoggedIn'
  return 'other'
}

export class TwitterCliError extends Error {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
  readonly args: string[]
  readonly kind: TwitterCliErrorKind
  /** Back-compat boolean for call sites that only care about auth. */
  readonly authMissing: boolean
  constructor(opts: {
    message: string
    exitCode: number
    stderr: string
    stdout: string
    args: string[]
    enoent?: boolean
  }) {
    super(opts.message)
    this.name = 'TwitterCliError'
    this.exitCode = opts.exitCode
    this.stderr = opts.stderr
    this.stdout = opts.stdout
    this.args = opts.args
    this.kind = classifyKind(opts)
    this.authMissing = this.kind === 'notLoggedIn'
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

function daemonError(op: string, err: TwitterDaemonRemoteError): TwitterCliError {
  return new TwitterCliError({
    message: err.message,
    exitCode: 1,
    stderr: err.message,
    stdout: '',
    args: [op],
  })
}

function getDaemonClient(): TwitterDaemonClient {
  if (!daemonClient) {
    daemonClient = new TwitterDaemonClient(() =>
      Bun.spawn({
        cmd: [TWITTER_CMD, 'daemon'],
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, NO_COLOR: '1' },
      }),
    )
  }
  return daemonClient
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
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn({
      cmd: [TWITTER_CMD, ...finalArgs],
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NO_COLOR: '1' },
    })
  } catch (err) {
    // Bun.spawn throws synchronously when the binary can't be resolved
    // (ENOENT / EACCES). That's the "user never installed the CLI" case —
    // surface it with enoent: true so the boot gate shows install hints
    // instead of a generic "something broke" message.
    const msg = (err as Error).message ?? String(err)
    throw new TwitterCliError({
      message: `cannot execute ${TWITTER_CMD}: ${msg}`,
      exitCode: -1,
      stderr: msg,
      stdout: '',
      args: finalArgs,
      enoent: true,
    })
  }

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
    const helpful = describeCliFailure({
      exitCode,
      args: finalArgs,
      stderr: stderr.trim(),
      stdout: stdout.trim(),
    })
    const detailLine = (stderr || stdout)
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(Boolean)
    throw new TwitterCliError({
      message:
        helpful ??
        `twitter ${finalArgs.join(' ')} exited ${exitCode}${detailLine ? `: ${detailLine}` : ''}`,
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

async function callTwitter<T>(
  op: string,
  params: Record<string, unknown>,
  spawnArgs: string[],
  opts: { timeout?: number } = {},
): Promise<T> {
  if (daemonDisabled) return runTwitter<T>(spawnArgs, opts)
  try {
    return await getDaemonClient().request<T>(op, params)
  } catch (err) {
    if (err instanceof TwitterDaemonRemoteError) throw daemonError(op, err)
    if (err instanceof TwitterDaemonTransportError) {
      daemonDisabled = true
      return runTwitter<T>(spawnArgs, opts)
    }
    throw err
  }
}

// -- High-level API wrappers --------------------------------------------------

export async function whoami(): Promise<UserResponse['data']['user']> {
  const res = await callTwitter<UserResponse>('whoami', {}, ['whoami'])
  if (!res.ok) throw new Error(res.error ?? 'whoami failed')
  return res.data.user
}

function pickNextCursor(r: FeedResponse): string | undefined {
  return r.nextCursor ?? r.next_cursor ?? r.cursor ?? r.pagination?.nextCursor
}

export async function feed(
  opts: { cursor?: string; max?: number; fullText?: boolean } = {},
): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
  const args = ['feed']
  if (opts.max) args.push('--max', String(opts.max))
  if (opts.cursor) args.push('--cursor', opts.cursor)
  if (opts.fullText) args.push('--full-text')
  const r = await callTwitter<FeedResponse>(
    'feed',
    { max: opts.max, cursor: opts.cursor, fullText: opts.fullText },
    args,
  )
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
  const r = await callTwitter<FeedResponse>(
    'search',
    {
      query,
      tab: opts.tab,
      max: opts.max,
      cursor: opts.cursor,
      from: opts.from,
      lang: opts.lang,
      since: opts.since,
      until: opts.until,
      hasImages: opts.hasImages,
      hasLinks: opts.hasLinks,
      excludeRetweets: opts.excludeRetweets,
      filter: opts.filter,
      fullText: opts.fullText,
    },
    args,
  )
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
  opts: { fullText?: boolean; max?: number; pages?: number } = {},
): Promise<{ tweet: Tweet; replies: Tweet[] }> {
  const args = ['tweet', id]
  if (opts.max) args.push('--max', String(opts.max))
  if (opts.pages) args.push('--pages', String(opts.pages))
  if (opts.fullText) args.push('--full-text')
  const r = await callTwitter<TweetDetailResponse>(
    'tweet_detail',
    { id, max: opts.max, pageLimit: opts.pages, fullText: opts.fullText },
    args,
  )
  if (!r.ok) throw new Error(r.error ?? 'tweet failed')
  return pickTweetDetail(r.data, id)
}

type TweetHeadResponse = { ok: boolean; data: { tweet: Tweet }; error?: string }

export async function tweetHead(id: string): Promise<Tweet> {
  const spawnArgs = ['tweet', id, '--max', '1', '--pages', '1']
  if (daemonDisabled) {
    const r = await runTwitter<TweetDetailResponse>(spawnArgs)
    if (!r.ok) throw new Error(r.error ?? 'tweet head failed')
    return pickTweetDetail(r.data, id).tweet
  }
  try {
    const r = await getDaemonClient().request<TweetHeadResponse>('tweet_head', { id })
    if (!r.ok) throw new Error(r.error ?? 'tweet head failed')
    if (!r.data?.tweet?.id) throw new Error(`tweet ${id} not found`)
    return r.data.tweet
  } catch (err) {
    if (err instanceof TwitterDaemonRemoteError) throw daemonError('tweet_head', err)
    if (err instanceof TwitterDaemonTransportError) {
      daemonDisabled = true
      const r = await runTwitter<TweetDetailResponse>(spawnArgs)
      if (!r.ok) throw new Error(r.error ?? 'tweet head failed')
      return pickTweetDetail(r.data, id).tweet
    }
    throw err
  }
}

export async function bookmarks(
  opts: { max?: number; cursor?: string; fullText?: boolean } = {},
): Promise<{ tweets: Tweet[]; nextCursor?: string }> {
  const args = ['bookmarks']
  if (opts.max) args.push('--max', String(opts.max))
  if (opts.cursor) args.push('--cursor', opts.cursor)
  if (opts.fullText) args.push('--full-text')
  const r = await callTwitter<FeedResponse>(
    'bookmarks',
    { max: opts.max, cursor: opts.cursor, fullText: opts.fullText },
    args,
  )
  if (!r.ok) throw new Error(r.error ?? 'bookmarks failed')
  return { tweets: r.data, nextCursor: pickNextCursor(r) }
}

export async function userProfile(handle: string): Promise<UserResponse['data']['user']> {
  const normalized = handle.replace(/^@/, '')
  const r = await callTwitter<UserResponse>('user_profile', { handle: normalized }, ['user', normalized])
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
  const r = await callTwitter<FeedResponse>(
    'user_posts',
    { handle: handle.replace(/^@/, ''), max: opts.max, cursor: opts.cursor, fullText: opts.fullText },
    args,
  )
  if (!r.ok) throw new Error(r.error ?? 'user-posts failed')
  return { tweets: r.data, nextCursor: pickNextCursor(r) }
}

// -- Write operations (Phase 7 will wire keybindings to these) ---------------

export async function like(id: string): Promise<void> {
  const r = await callTwitter<WriteResponse>('like', { id }, ['like', id])
  if (!r.ok) throw new Error(r.error ?? 'like failed')
}

export async function unlike(id: string): Promise<void> {
  const r = await callTwitter<WriteResponse>('unlike', { id }, ['unlike', id])
  if (!r.ok) throw new Error(r.error ?? 'unlike failed')
}

export async function retweet(id: string): Promise<void> {
  const r = await callTwitter<WriteResponse>('retweet', { id }, ['retweet', id])
  if (!r.ok) throw new Error(r.error ?? 'retweet failed')
}

export async function unretweet(id: string): Promise<void> {
  const r = await callTwitter<WriteResponse>('unretweet', { id }, ['unretweet', id])
  if (!r.ok) throw new Error(r.error ?? 'unretweet failed')
}

export async function bookmark(id: string): Promise<void> {
  const r = await callTwitter<WriteResponse>('bookmark', { id }, ['bookmark', id])
  if (!r.ok) throw new Error(r.error ?? 'bookmark failed')
}

export async function unbookmark(id: string): Promise<void> {
  const r = await callTwitter<WriteResponse>('unbookmark', { id }, ['unbookmark', id])
  if (!r.ok) throw new Error(r.error ?? 'unbookmark failed')
}

export async function follow(handle: string): Promise<void> {
  const normalized = handle.replace(/^@/, '')
  const r = await callTwitter<WriteResponse>('follow', { handle: normalized }, ['follow', normalized])
  if (!r.ok) throw new Error(r.error ?? 'follow failed')
}

export async function unfollow(handle: string): Promise<void> {
  const normalized = handle.replace(/^@/, '')
  const r = await callTwitter<WriteResponse>('unfollow', { handle: normalized }, ['unfollow', normalized])
  if (!r.ok) throw new Error(r.error ?? 'unfollow failed')
}

export async function postTweet(
  text: string,
  opts: { images?: string[]; replyTo?: string } = {},
): Promise<Tweet> {
  const args = ['post', text]
  if (opts.replyTo) args.push('--reply-to', opts.replyTo)
  for (const img of opts.images ?? []) args.push('-i', img)
  const r = await callTwitter<WriteResponse>(
    'post',
    { text, replyTo: opts.replyTo, images: opts.images ?? [] },
    args,
  )
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
  const r = await callTwitter<WriteResponse>(
    'reply',
    { id, text, images: opts.images ?? [] },
    args,
  )
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
  const r = await callTwitter<WriteResponse>(
    'quote',
    { id, text, images: opts.images ?? [] },
    args,
  )
  if (!r.ok) throw new Error(r.error ?? 'quote failed')
  return r.data as Tweet
}
