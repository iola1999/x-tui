import { describe, expect, it } from 'bun:test'
import { pickTweetDetail } from '../twitterCli.js'

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
