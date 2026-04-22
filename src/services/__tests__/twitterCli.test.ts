import { describe, expect, it } from 'bun:test'
import {
  describeCliFailure,
  pickTweetDetail,
  resolveTwitterCmd,
  TwitterCliError,
} from '../twitterCli.js'

/**
 * Regression guard for the tweet-detail shape.
 *
 * twitter-cli 0.8 returns `data: [mainTweet, ...replies]` as an array; an
 * earlier draft of our types expected `data: { tweet, replies }`. When the
 * shape drifted, the detail screen crashed with
 * `undefined is not an object (evaluating 'tweet.createdAtISO')`.
 *
 * These tests pin both accepted shapes + the empty-array error case so we
 * won't re-ship the same crash.
 */

type MinimalTweet = { id: string; [k: string]: unknown }

function t(id: string): MinimalTweet {
  return { id, text: '', author: { id: '1', name: 'n', screenName: 'n' }, metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 } }
}

describe('pickTweetDetail', () => {
  it('array shape: [main, ...replies]', () => {
    const { tweet, replies } = pickTweetDetail([t('a'), t('b'), t('c')], 'a')
    expect(tweet.id).toBe('a')
    expect(replies.map(r => r.id)).toEqual(['b', 'c'])
  })

  it('array shape with no replies', () => {
    const { tweet, replies } = pickTweetDetail([t('a')], 'a')
    expect(tweet.id).toBe('a')
    expect(replies).toEqual([])
  })

  it('object shape: { tweet, replies }', () => {
    const { tweet, replies } = pickTweetDetail({ tweet: t('x'), replies: [t('y')] }, 'x')
    expect(tweet.id).toBe('x')
    expect(replies.map(r => r.id)).toEqual(['y'])
  })

  it('object shape: missing replies defaults to []', () => {
    const { replies } = pickTweetDetail({ tweet: t('x') }, 'x')
    expect(replies).toEqual([])
  })

  it('empty array throws a helpful error', () => {
    expect(() => pickTweetDetail([], 'missing')).toThrow(/missing/)
  })

  it('null throws a helpful error (does not silently produce undefined tweet)', () => {
    expect(() => pickTweetDetail(null, 'missing')).toThrow(/missing/)
  })

  it('object without tweet throws', () => {
    expect(() => pickTweetDetail({ replies: [t('y')] }, 'missing')).toThrow(/missing/)
  })
})

/**
 * Classification drives the onboarding gate. If the regexes drift or the
 * ENOENT branch stops setting enoent=true, the user would see a generic
 * "error" panel instead of the install/login instructions.
 */
describe('TwitterCliError.kind', () => {
  function make(opts: { stderr?: string; stdout?: string; enoent?: boolean }): TwitterCliError {
    return new TwitterCliError({
      message: 'x',
      exitCode: 1,
      stderr: opts.stderr ?? '',
      stdout: opts.stdout ?? '',
      args: ['whoami', '--json'],
      enoent: opts.enoent,
    })
  }

  it('enoent wins regardless of stderr shape', () => {
    expect(make({ enoent: true, stderr: 'unauthorized 401' }).kind).toBe('cliMissing')
  })

  it('recognizes several auth-missing stderr phrasings', () => {
    for (const s of [
      'Error: not logged in',
      'unauthenticated',
      'HTTP 401 Unauthorized',
      'no session — run `twitter auth login`',
      'Not Authenticated',
    ]) {
      expect(make({ stderr: s }).kind).toBe('notLoggedIn')
    }
  })

  it('falls through to "other" for random failures', () => {
    expect(make({ stderr: 'rate limit exceeded' }).kind).toBe('other')
    expect(make({ stderr: '' }).kind).toBe('other')
  })

  it('also checks stdout for auth markers (some CLI versions print to stdout)', () => {
    expect(make({ stdout: 'no session' }).kind).toBe('notLoggedIn')
  })

  it('keeps the legacy `authMissing` boolean in sync with kind', () => {
    expect(make({ stderr: '401' }).authMissing).toBe(true)
    expect(make({ enoent: true }).authMissing).toBe(false)
    expect(make({ stderr: 'network down' }).authMissing).toBe(false)
  })
})

describe('resolveTwitterCmd', () => {
  it('prefers explicit X_TUI_TWITTER_CMD over local sibling fork', () => {
    const resolved = resolveTwitterCmd(
      { X_TUI_TWITTER_CMD: '/tmp/custom-twitter' },
      () => true,
      'file:///Users/fan/project/nodejs/x-tui/src/services/twitterCli.ts',
    )
    expect(resolved).toBe('/tmp/custom-twitter')
  })

  it('auto-detects sibling twitter-cli fork when env is unset', () => {
    const resolved = resolveTwitterCmd(
      {},
      path => path === '/Users/fan/project/nodejs/twitter-cli/.venv/bin/twitter',
      'file:///Users/fan/project/nodejs/x-tui/src/services/twitterCli.ts',
    )
    expect(resolved).toBe('/Users/fan/project/nodejs/twitter-cli/.venv/bin/twitter')
  })

  it('falls back to PATH twitter when no override or sibling fork exists', () => {
    const resolved = resolveTwitterCmd(
      {},
      () => false,
      'file:///Users/fan/project/nodejs/x-tui/src/services/twitterCli.ts',
    )
    expect(resolved).toBe('twitter')
  })
})

describe('describeCliFailure', () => {
  it('turns old-cli --pages usage errors into an actionable hint', () => {
    expect(
      describeCliFailure({
        exitCode: 2,
        args: ['tweet', '123', '--pages', '1', '--json'],
        stderr: 'Error: No such option: --pages',
        stdout: '',
      }),
    ).toMatch(/too old/i)
  })
})
