import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  currentScreen,
  getState,
  pop,
  push,
  replaceRoot,
  setActiveTab,
} from '../store.js'

/**
 * Navigation stack invariants. These are what listCache / back-navigation
 * rely on — if we ever let pop() leave the root tab empty, or let push()
 * leak screens across tabs, the whole "return to feed with the same focus
 * you left on" UX silently breaks.
 */

// The store is module-scoped so tests must reset between cases.
function resetStore(): void {
  // Pop every non-root screen in every tab, and jump back to feed.
  setActiveTab('feed')
  for (const tab of ['feed', 'search', 'bookmarks', 'profile'] as const) {
    setActiveTab(tab)
    while (getState().stacks[tab].length > 1) pop()
  }
  setActiveTab('feed')
}

describe('store navigation', () => {
  beforeEach(resetStore)
  afterEach(resetStore)

  it('starts on feed with a root-only stack per tab', () => {
    const s = getState()
    expect(s.activeTab).toBe('feed')
    expect(s.stacks.feed).toHaveLength(1)
    expect(s.stacks.search).toHaveLength(1)
    expect(s.stacks.bookmarks).toHaveLength(1)
    expect(s.stacks.profile).toHaveLength(1)
    expect(currentScreen().kind).toBe('feed')
  })

  it('push() adds to the ACTIVE tab only — other tabs untouched', () => {
    push({ kind: 'tweet', id: 'abc' })
    expect(getState().stacks.feed).toHaveLength(2)
    expect(getState().stacks.search).toHaveLength(1)
    expect(currentScreen()).toEqual({ kind: 'tweet', id: 'abc' })

    setActiveTab('search')
    expect(currentScreen().kind).toBe('search')
    expect(getState().stacks.feed).toHaveLength(2) // feed stack preserved
  })

  it('pop() returns false at root — prevents accidentally emptying the stack', () => {
    expect(pop()).toBe(false)
    expect(getState().stacks.feed).toHaveLength(1)
  })

  it('pop() removes only the top of the active tab', () => {
    push({ kind: 'tweet', id: '1' })
    push({ kind: 'tweet', id: '2' })
    expect(pop()).toBe(true)
    expect(currentScreen()).toEqual({ kind: 'tweet', id: '1' })
    expect(getState().stacks.feed).toHaveLength(2)
  })

  it('switching tabs preserves each tab’s deep stack', () => {
    push({ kind: 'tweet', id: 'feed-1' })
    setActiveTab('search')
    push({ kind: 'profile', handle: 'alice' })
    // Go back to feed — we should land on feed-1, not the search profile.
    setActiveTab('feed')
    expect(currentScreen()).toEqual({ kind: 'tweet', id: 'feed-1' })
    setActiveTab('search')
    expect(currentScreen()).toEqual({ kind: 'profile', handle: 'alice' })
  })

  it('replaceRoot overwrites only the root, clearing deeper entries', () => {
    push({ kind: 'tweet', id: '1' })
    replaceRoot('feed', { kind: 'feed' })
    expect(getState().stacks.feed).toHaveLength(1)
    expect(currentScreen()).toEqual({ kind: 'feed' })
  })
})
