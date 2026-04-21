import { describe, expect, test } from 'bun:test'
import { tokenizeTweet } from '../TweetText.js'

describe('tokenizeTweet', () => {
  test('plain text is one segment', () => {
    expect(tokenizeTweet('hello world')).toEqual([{ kind: 'text', value: 'hello world' }])
  })

  test('mention', () => {
    expect(tokenizeTweet('hi @alice there')).toEqual([
      { kind: 'text', value: 'hi ' },
      { kind: 'mention', handle: 'alice' },
      { kind: 'text', value: ' there' },
    ])
  })

  test('hashtag', () => {
    expect(tokenizeTweet('ship it #friday')).toEqual([
      { kind: 'text', value: 'ship it ' },
      { kind: 'hashtag', tag: 'friday' },
    ])
  })

  test('url', () => {
    expect(tokenizeTweet('see https://example.com for more')).toEqual([
      { kind: 'text', value: 'see ' },
      { kind: 'url', url: 'https://example.com' },
      { kind: 'text', value: ' for more' },
    ])
  })

  test('mixed mention + hashtag + url', () => {
    const segs = tokenizeTweet('@alice #awesome https://x.com/a')
    expect(segs.map(s => s.kind)).toEqual(['mention', 'text', 'hashtag', 'text', 'url'])
  })

  test('CJK text is kept as-is', () => {
    expect(tokenizeTweet('测试 @user 你好')).toEqual([
      { kind: 'text', value: '测试 ' },
      { kind: 'mention', handle: 'user' },
      { kind: 'text', value: ' 你好' },
    ])
  })

  test('ignores @ not at a word start in username', () => {
    // The regex matches @ followed by [A-Za-z0-9_]{1,30}; "@中" has no ASCII
    // after the @, so it falls through as plain text.
    expect(tokenizeTweet('email me at bob@example.com')).toEqual([
      { kind: 'text', value: 'email me at bob' },
      { kind: 'mention', handle: 'example' },
      { kind: 'text', value: '.com' },
    ])
  })

  test('handles empty string', () => {
    expect(tokenizeTweet('')).toEqual([])
  })

  test('t.co short URL', () => {
    const segs = tokenizeTweet('https://t.co/abc end')
    expect(segs[0]).toEqual({ kind: 'url', url: 'https://t.co/abc' })
  })
})
