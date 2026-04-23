import { describe, expect, it } from 'bun:test'
import { shouldFollowScrollOnGrowth } from '../scrollFollow.js'

describe('shouldFollowScrollOnGrowth', () => {
  it('does not auto-follow when previous content was not scrollable and sticky mode was never enabled', () => {
    expect(
      shouldFollowScrollOnGrowth({
        sticky: false,
        grew: true,
        scrollTopBeforeFollow: 0,
        prevMaxScroll: 0,
        pendingScrollDelta: 0,
      }),
    ).toBe(false)
  })

  it('still follows when sticky mode is enabled or the user was already at a real scrollable bottom edge', () => {
    expect(
      shouldFollowScrollOnGrowth({
        sticky: true,
        grew: true,
        scrollTopBeforeFollow: 0,
        prevMaxScroll: 0,
        pendingScrollDelta: 0,
      }),
    ).toBe(true)

    expect(
      shouldFollowScrollOnGrowth({
        sticky: false,
        grew: true,
        scrollTopBeforeFollow: 12,
        prevMaxScroll: 12,
        pendingScrollDelta: 0,
      }),
    ).toBe(true)
  })

  it('does not follow while an upward scroll is still draining', () => {
    expect(
      shouldFollowScrollOnGrowth({
        sticky: true,
        grew: true,
        scrollTopBeforeFollow: 12,
        prevMaxScroll: 12,
        pendingScrollDelta: -1,
      }),
    ).toBe(false)
  })
})
