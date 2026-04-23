import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { currentScreen, getState, pop, push, setActiveTab } from '../../state/store.js'
import { makeTweetActions } from '../tweetActions.js'
import type { Tweet } from '../../types/tweet.js'

function resetStore(): void {
  setActiveTab('feed')
  for (const tab of ['feed', 'search', 'bookmarks', 'profile'] as const) {
    setActiveTab(tab)
    while (getState().stacks[tab].length > 1) pop()
  }
  setActiveTab('feed')
}

function makeTweet(media: Tweet['media']): Tweet {
  return {
    id: 'tweet-1',
    text: 'hello',
    author: { id: 'author-1', name: 'Alice', screenName: 'alice' },
    metrics: { likes: 0, retweets: 0, replies: 0, quotes: 0, views: 0, bookmarks: 0 },
    media,
  }
}

describe('makeTweetActions.onMedia', () => {
  beforeEach(resetStore)
  afterEach(resetStore)

  it('opens the image viewer at the requested photo index', () => {
    const actions = makeTweetActions(() => {})
    const tweet = makeTweet([
      { type: 'photo', url: 'https://img/1.jpg' },
      { type: 'photo', url: 'https://img/2.jpg' },
      { type: 'photo', url: 'https://img/3.jpg' },
    ])

    actions.onMedia(tweet, 2)

    expect(currentScreen()).toEqual({
      kind: 'imageViewer',
      urls: ['https://img/1.jpg', 'https://img/2.jpg', 'https://img/3.jpg'],
      index: 2,
      tweetId: 'tweet-1',
    })
  })

  it('still defaults to the first photo for keyboard open', () => {
    const actions = makeTweetActions(() => {})
    const tweet = makeTweet([
      { type: 'photo', url: 'https://img/1.jpg' },
      { type: 'photo', url: 'https://img/2.jpg' },
    ])

    actions.onMedia(tweet)

    expect(currentScreen()).toEqual({
      kind: 'imageViewer',
      urls: ['https://img/1.jpg', 'https://img/2.jpg'],
      index: 0,
      tweetId: 'tweet-1',
    })
  })
})
