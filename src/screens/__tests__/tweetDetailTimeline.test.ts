import { describe, expect, it } from 'bun:test'
import {
  buildTweetDetailTimeline,
  getDetailScrollRestoreTarget,
  pickVisibleDetailIndex,
} from '../tweetDetailTimeline.js'
import type { Tweet } from '../../types/tweet.js'

function tweet(id: string): Tweet {
  return {
    id,
    text: `tweet ${id}`,
    createdAtISO: '2026-04-23T00:00:00.000Z',
    createdAtLocal: '2026-04-23 08:00',
    author: { id: 'u1', name: 'n', screenName: 'n' },
    metrics: { replies: 0, retweets: 0, likes: 0, bookmarks: 0, views: 0, quotes: 0 },
    media: [],
  }
}

describe('buildTweetDetailTimeline', () => {
  it('places the main tweet before replies in one linear timeline', () => {
    const timeline = buildTweetDetailTimeline(tweet('root'), [tweet('r1'), tweet('r2')])
    expect(timeline.map(t => t.id)).toEqual(['root', 'r1', 'r2'])
  })
})

describe('pickVisibleDetailIndex', () => {
  it('keeps focus on the main tweet until its full height has scrolled past the top edge', () => {
    const cards = [
      { top: 0, height: 12 },
      { top: 14, height: 4 },
    ]

    expect(pickVisibleDetailIndex(cards, 0)).toBe(0)
    expect(pickVisibleDetailIndex(cards, 8)).toBe(0)
    expect(pickVisibleDetailIndex(cards, 11)).toBe(0)
    expect(pickVisibleDetailIndex(cards, 12)).toBe(1)
  })

  it('falls back to the last available tweet when scrolled to the end', () => {
    const cards = [
      { top: 0, height: 4 },
      null,
      { top: 10, height: 3 },
    ]

    expect(pickVisibleDetailIndex(cards, 99)).toBe(2)
  })
})

describe('getDetailScrollRestoreTarget', () => {
  it('restores the previous scrollTop when replies arrive after content already rendered', () => {
    expect(getDetailScrollRestoreTarget(1, 4, 0)).toBe(0)
    expect(getDetailScrollRestoreTarget(3, 7, 18)).toBe(18)
  })

  it('does not request a restore on first paint or when the timeline length stays the same', () => {
    expect(getDetailScrollRestoreTarget(0, 1, 0)).toBeNull()
    expect(getDetailScrollRestoreTarget(4, 4, 12)).toBeNull()
  })
})
