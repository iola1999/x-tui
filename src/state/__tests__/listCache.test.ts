import { beforeEach, describe, expect, test } from 'bun:test'
import {
  __seedForTest,
  clearAllListCache,
  getListEntry,
  invalidateList,
  mutateTweetEverywhere,
  mutateTweetInList,
  setFocusedIndex,
} from '../listCache.js'
import type { Tweet } from '../../types/tweet.js'

function makeTweet(id: string, overrides: Partial<Tweet> = {}): Tweet {
  return {
    id,
    text: `tweet ${id}`,
    author: { id: `a-${id}`, name: `User ${id}`, screenName: `user${id}` },
    metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    ...overrides,
  }
}

beforeEach(() => {
  clearAllListCache()
})

describe('listCache', () => {
  test('getListEntry returns null on miss', () => {
    expect(getListEntry('feed')).toBeNull()
  })

  test('mutateTweetInList is a no-op when the key is absent', () => {
    expect(() => mutateTweetInList('feed', 'x', t => t)).not.toThrow()
    expect(getListEntry('feed')).toBeNull()
  })

  test('seed + mutate updates the stored tweet', () => {
    __seedForTest('feed', [makeTweet('1'), makeTweet('2')])
    const before = getListEntry('feed')
    expect(before).not.toBeNull()
    expect(before!.tweets).toHaveLength(2)

    mutateTweetInList('feed', '2', t => ({
      ...t,
      metrics: { ...t.metrics, likes: 42 },
    }))
    const after = getListEntry('feed')!
    expect(after.tweets[1]!.metrics.likes).toBe(42)
    expect(after.tweets[0]!.metrics.likes).toBe(0)
  })

  test('mutateTweetEverywhere hits every list containing that id', () => {
    __seedForTest('feed', [makeTweet('a'), makeTweet('b')])
    __seedForTest('bookmarks', [makeTweet('b'), makeTweet('c')])
    mutateTweetEverywhere('b', t => ({ ...t, text: 'updated' }))
    expect(getListEntry('feed')!.tweets[1]!.text).toBe('updated')
    expect(getListEntry('bookmarks')!.tweets[0]!.text).toBe('updated')
    expect(getListEntry('feed')!.tweets[0]!.text).toBe('tweet a')
    expect(getListEntry('bookmarks')!.tweets[1]!.text).toBe('tweet c')
  })

  test('setFocusedIndex preserves other fields', () => {
    __seedForTest('feed', [makeTweet('1')])
    setFocusedIndex('feed', 7)
    const e = getListEntry('feed')!
    expect(e.focusedIndex).toBe(7)
    expect(e.tweets).toHaveLength(1)
  })

  test('invalidateList drops the cache entry', () => {
    __seedForTest('feed', [makeTweet('1')])
    invalidateList('feed')
    expect(getListEntry('feed')).toBeNull()
  })
})
