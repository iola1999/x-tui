import type { Tweet } from '../types/tweet.js'

export type DetailCardMetrics = {
  top: number
  height: number
}

export function buildTweetDetailTimeline(tweet: Tweet, replies: Tweet[]): Tweet[] {
  return [tweet, ...replies]
}

export function pickVisibleDetailIndex(
  cards: Array<DetailCardMetrics | null | undefined>,
  scrollTop: number,
): number {
  let lastSeen = 0
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (!card) continue
    lastSeen = i
    if (card.top + card.height > scrollTop) return i
  }
  return lastSeen
}

export function getDetailScrollRestoreTarget(
  previousTimelineLength: number,
  nextTimelineLength: number,
  previousScrollTop: number,
): number | null {
  if (previousTimelineLength <= 0) return null
  if (previousTimelineLength === nextTimelineLength) return null
  return previousScrollTop
}
