import React, { useCallback, useEffect, useRef } from 'react'
import {
  Box,
  ScrollBox,
  Text,
  useInput,
  useKeybinding,
  useRegisterKeybindingContext,
  type ScrollBoxHandle,
  type DOMElement,
} from '@anthropic/ink'
import type { Tweet } from '../types/tweet.js'
import { TweetCard } from './TweetCard.js'
import { LoadingLine, Spinner } from './Spinner.js'
import { TW_DIM } from '../theme/twitterTheme.js'

type Props = {
  tweets: Tweet[]
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  /** Externally-controlled focus index, restored from the list cache. */
  focusedIndex?: number
  onFocusChange?: (idx: number) => void
  onOpen?: (t: Tweet) => void
  onProfile?: (screenName: string) => void
  onReachEnd?: () => void
  onRefresh?: () => void
  onLike?: (t: Tweet) => void
  onRetweet?: (t: Tweet) => void
  onBookmark?: (t: Tweet) => void
  onReply?: (t: Tweet) => void
  onQuote?: (t: Tweet) => void
  onFollow?: (t: Tweet) => void
  onCopyLink?: (t: Tweet) => void
  onMedia?: (t: Tweet) => void
}

/**
 * Keyboard-navigable list of TweetCards with `List` keybinding context.
 *
 * Focus is EITHER controlled (via focusedIndex/onFocusChange) OR internal.
 * The controlled path lets listCache restore scroll state across navigation
 * pops without re-mounting the list.
 *
 * Mouse wheel scroll is handled explicitly via useInput — Ink's keybinding
 * system drops wheel events at the match layer, so ScrollBox doesn't receive
 * them unless we forward.
 */
export function TweetList({
  tweets,
  loading,
  error,
  emptyMessage,
  focusedIndex,
  onFocusChange,
  onOpen,
  onProfile,
  onReachEnd,
  onRefresh,
  onLike,
  onRetweet,
  onBookmark,
  onReply,
  onQuote,
  onFollow,
  onCopyLink,
  onMedia,
}: Props): React.ReactNode {
  useRegisterKeybindingContext('List', true)
  const [internalFocus, setInternalFocus] = React.useState(0)
  const focused = focusedIndex ?? internalFocus
  const setFocused = useCallback(
    (n: number | ((p: number) => number)) => {
      setInternalFocus(prev => {
        const next = typeof n === 'function' ? n(prev) : n
        onFocusChange?.(next)
        return next
      })
    },
    [onFocusChange],
  )

  // Sync internal state when controlled index changes from outside.
  useEffect(() => {
    if (focusedIndex !== undefined) setInternalFocus(focusedIndex)
  }, [focusedIndex])

  const scrollRef = useRef<ScrollBoxHandle | null>(null)
  const cardRefs = useRef<Array<DOMElement | null>>([])

  useEffect(() => {
    if (focused >= tweets.length) setFocused(Math.max(0, tweets.length - 1))
  }, [focused, tweets.length, setFocused])

  // Scroll focused card into view on focus change.
  useEffect(() => {
    const el = cardRefs.current[focused]
    if (el && scrollRef.current) scrollRef.current.scrollToElement(el, 1)
  }, [focused])

  const focusedTweet = tweets[focused]
  const currentOr = useCallback(
    (cb?: (t: Tweet) => void) => () => {
      if (focusedTweet && cb) cb(focusedTweet)
    },
    [focusedTweet],
  )

  const moveBy = useCallback(
    (delta: number) => {
      setFocused(i => {
        const next = Math.max(0, Math.min(tweets.length - 1, i + delta))
        if (next === tweets.length - 1) onReachEnd?.()
        return next
      })
    },
    [tweets.length, onReachEnd, setFocused],
  )

  // Mouse wheel — explicit forwarding. Each notch moves focus by one;
  // scroll-to-element is driven by the focus-change effect above, so the
  // focused card stays in view.
  useInput((_input, key) => {
    if (key.wheelUp) moveBy(-1)
    else if (key.wheelDown) moveBy(1)
  })

  useKeybinding('list:down', () => moveBy(1), { context: 'List' })
  useKeybinding('list:up', () => moveBy(-1), { context: 'List' })
  useKeybinding('list:pageDown', () => moveBy(10), { context: 'List' })
  useKeybinding('list:pageUp', () => moveBy(-10), { context: 'List' })
  useKeybinding('list:top', () => setFocused(0), { context: 'List' })
  useKeybinding(
    'list:bottom',
    () => {
      setFocused(Math.max(0, tweets.length - 1))
      scrollRef.current?.scrollToBottom()
      onReachEnd?.()
    },
    { context: 'List' },
  )
  useKeybinding('list:open', currentOr(onOpen), { context: 'List' })
  useKeybinding('list:media', currentOr(onMedia), { context: 'List' })
  useKeybinding('list:like', currentOr(onLike), { context: 'List' })
  useKeybinding('list:retweet', currentOr(onRetweet), { context: 'List' })
  useKeybinding('list:bookmark', currentOr(onBookmark), { context: 'List' })
  useKeybinding('list:reply', currentOr(onReply), { context: 'List' })
  useKeybinding('list:quote', currentOr(onQuote), { context: 'List' })
  useKeybinding('list:follow', currentOr(onFollow), { context: 'List' })
  useKeybinding('list:copyLink', currentOr(onCopyLink), { context: 'List' })
  useKeybinding('app:refresh', () => onRefresh?.(), { context: 'Global' })

  if (error && tweets.length === 0) {
    return (
      <Box flexDirection="column" padding={2} gap={1}>
        <Text color="error">Error: {error}</Text>
        <Text color={TW_DIM}>Press Ctrl+R to retry.</Text>
      </Box>
    )
  }

  if (loading && tweets.length === 0) {
    return (
      <Box padding={2}>
        <LoadingLine label="Loading timeline" />
      </Box>
    )
  }

  if (!loading && tweets.length === 0) {
    return (
      <Box padding={2}>
        <Text color={TW_DIM}>{emptyMessage ?? 'No tweets.'}</Text>
      </Box>
    )
  }

  return (
    <ScrollBox ref={scrollRef} flexDirection="column" flexGrow={1}>
      {tweets.map((t, i) => {
        // Backfill / pagination races can occasionally insert undefined slots.
        // Skip rather than crash on `.id` access.
        if (!t) return null
        return (
          <Box
            key={t.id}
            ref={el => {
              cardRefs.current[i] = el
            }}
            flexShrink={0}
            flexDirection="column"
          >
            <TweetCard
              tweet={t}
              isFocused={i === focused}
              onOpen={onOpen}
              onProfile={onProfile}
            />
          </Box>
        )
      })}
      {loading && (
        <Box padding={1} flexDirection="row" gap={1}>
          <Spinner />
          <Text color={TW_DIM}>Loading more…</Text>
        </Box>
      )}
    </ScrollBox>
  )
}
