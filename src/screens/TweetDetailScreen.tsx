import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
  Box,
  ScrollBox,
  Text,
  useInput,
  useKeybinding,
  useRegisterKeybindingContext,
  type DOMElement,
  type ScrollBoxHandle,
} from '@anthropic/ink'
import { tweetDetail, tweetHead } from '../services/twitterCli.js'
import type { Tweet } from '../types/tweet.js'
import { TweetCard } from '../components/TweetCard.js'
import { LoadingLine, Spinner } from '../components/Spinner.js'
import { mutateTweetEverywhere } from '../state/listCache.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'
import {
  makeTweetActions,
  unbookmarkTweet,
  unfollowUser,
  unlikeTweet,
  unretweetTweet,
} from '../services/tweetActions.js'
import {
  buildTweetDetailTimeline,
  getDetailScrollRestoreTarget,
  pickVisibleDetailIndex,
} from './tweetDetailTimeline.js'

/**
 * Single tweet + replies. Uses a small in-memory cache separate from listCache
 * (because the shape is tweet + replies[], not a flat list). Mutations still
 * fan out through mutateTweetEverywhere so counts stay in sync across the app.
 */
type DetailEntry = {
  tweet: Tweet
  replies: Tweet[]
  tweetFetchedAt: number
  repliesFetchedAt?: number
}

const detailCache = new Map<string, DetailEntry>()
const detailListeners = new Map<string, Set<() => void>>()
const SCROLL_STEP = 3
const WHEEL_STEP = 4

function notifyDetail(id: string): void {
  const set = detailListeners.get(id)
  if (set) for (const l of set) l()
}

export function TweetDetailScreen({ id }: { id: string }): React.ReactNode {
  useRegisterKeybindingContext('List', true)
  const [, forceRerender] = useState(0)
  const [loading, setLoading] = useState(() => !detailCache.get(id)?.tweet)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = React.useRef<ScrollBoxHandle | null>(null)
  const cardRefs = React.useRef<Array<DOMElement | null>>([])
  const pendingScrollRestoreRef = React.useRef<number | null>(null)

  useEffect(() => {
    const set = detailListeners.get(id) ?? (detailListeners.set(id, new Set()).get(id) as Set<() => void>)
    const l = () => forceRerender(n => n + 1)
    set.add(l)
    return () => {
      set.delete(l)
    }
  }, [id])

  const load = useCallback(async () => {
    const now = Date.now()
    const cached = detailCache.get(id)
    const tweetStale = !cached || now - cached.tweetFetchedAt > 60_000
    const repliesStale = !cached?.repliesFetchedAt || now - cached.repliesFetchedAt > 60_000

    if (!tweetStale && !repliesStale) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (tweetStale) {
        const head = await tweetHead(id)
        const prev = detailCache.get(id)
        pendingScrollRestoreRef.current = getDetailScrollRestoreTarget(
          prev ? 1 + prev.replies.length : 0,
          1 + (prev?.replies.length ?? 0),
          scrollRef.current?.getScrollTop() ?? 0,
        )
        detailCache.set(id, {
          tweet: head,
          replies: prev?.replies ?? [],
          tweetFetchedAt: Date.now(),
          repliesFetchedAt: prev?.repliesFetchedAt,
        })
        notifyDetail(id)
      }

      if (repliesStale) {
        const d = await tweetDetail(id, { pages: 1 })
        const prev = detailCache.get(id)
        pendingScrollRestoreRef.current = getDetailScrollRestoreTarget(
          prev ? 1 + prev.replies.length : 0,
          1 + d.replies.length,
          scrollRef.current?.getScrollTop() ?? 0,
        )
        detailCache.set(id, {
          tweet: d.tweet,
          replies: d.replies,
          tweetFetchedAt: Date.now(),
          repliesFetchedAt: Date.now(),
        })
        notifyDetail(id)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const cached = detailCache.get(id)
    const stale =
      !cached ||
      Date.now() - cached.tweetFetchedAt > 60_000 ||
      !cached.repliesFetchedAt ||
      Date.now() - cached.repliesFetchedAt > 60_000
    if (stale) void load()
    else setLoading(false)
  }, [id, load])

  const entry = detailCache.get(id) ?? null

  const mutator = useCallback(
    (tid: string, upd: Parameters<typeof mutateTweetEverywhere>[1]) => {
      mutateTweetEverywhere(tid, upd)
      const e = detailCache.get(id)
      if (!e) return
      if (e.tweet.id === tid) {
        detailCache.set(id, { ...e, tweet: upd(e.tweet) })
      } else {
        const rIdx = e.replies.findIndex(r => r.id === tid)
        if (rIdx >= 0) {
          const replies = [...e.replies]
          replies[rIdx] = upd(e.replies[rIdx]!)
          detailCache.set(id, { ...e, replies })
        }
      }
      notifyDetail(id)
    },
    [id],
  )

  const actions = useMemo(() => makeTweetActions(mutator), [mutator])
  const replies = entry?.replies ?? []
  const timeline = useMemo(
    () => (entry ? buildTweetDetailTimeline(entry.tweet, replies) : []),
    [entry, replies],
  )
  const [focused, setFocused] = useState(0)

  useEffect(() => {
    cardRefs.current.length = timeline.length
    if (focused >= timeline.length) setFocused(Math.max(0, timeline.length - 1))
  }, [focused, timeline.length])

  const syncFocusToScroll = useCallback(() => {
    const scrollTop = scrollRef.current?.getScrollTop() ?? 0
    const metrics = timeline.map((_, i) => {
      const node = cardRefs.current[i]?.yogaNode
      if (!node) return null
      return {
        top: node.getComputedTop(),
        height: node.getComputedHeight(),
      }
    })
    setFocused(prev => {
      const next = pickVisibleDetailIndex(metrics, scrollTop)
      return prev === next ? prev : next
    })
  }, [timeline])

  useLayoutEffect(() => {
    const target = pendingScrollRestoreRef.current
    const scroll = scrollRef.current
    if (target == null || !scroll) return
    pendingScrollRestoreRef.current = null
    const maxScroll = Math.max(0, scroll.getFreshScrollHeight() - scroll.getViewportHeight())
    scroll.scrollTo(Math.min(target, maxScroll))
    syncFocusToScroll()
  }, [syncFocusToScroll, timeline.length, entry?.repliesFetchedAt, entry?.tweetFetchedAt])

  useEffect(() => {
    syncFocusToScroll()
  }, [syncFocusToScroll, timeline.length, loading, error])

  const scrollBy = useCallback(
    (delta: number) => {
      const scroll = scrollRef.current
      if (!scroll) return
      scroll.scrollTo(scroll.getScrollTop() + delta)
      syncFocusToScroll()
    },
    [syncFocusToScroll],
  )

  const scrollToTop = useCallback(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    scroll.scrollTo(0)
    syncFocusToScroll()
  }, [syncFocusToScroll])

  const scrollToBottom = useCallback(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const maxScroll = Math.max(0, scroll.getFreshScrollHeight() - scroll.getViewportHeight())
    scroll.scrollTo(maxScroll)
    syncFocusToScroll()
  }, [syncFocusToScroll])

  const scrollPage = useCallback(
    (direction: 1 | -1) => {
      const scroll = scrollRef.current
      if (!scroll) return
      const step = Math.max(1, scroll.getViewportHeight() - 2)
      scrollBy(direction * step)
    },
    [scrollBy],
  )

  const focusedTweet = timeline[focused] ?? entry?.tweet
  const currentOr = useCallback(
    (cb?: (t: Tweet) => void) => () => {
      if (focusedTweet && cb) cb(focusedTweet)
    },
    [focusedTweet],
  )
  const openFocused = useCallback(() => {
    if (focusedTweet && focusedTweet.id !== id) actions.onOpen(focusedTweet)
  }, [actions, focusedTweet, id])
  const openTweet = useCallback(
    (tweet: Tweet) => {
      if (tweet.id !== id) actions.onOpen(tweet)
    },
    [actions, id],
  )

  useInput((_input, key) => {
    if (key.wheelUp) scrollBy(-WHEEL_STEP)
    else if (key.wheelDown) scrollBy(WHEEL_STEP)
  })

  useKeybinding(
    'list:unlike',
    () => {
      const t = focusedTweet
      if (t) void unlikeTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unretweet',
    () => {
      const t = focusedTweet
      if (t) void unretweetTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unbookmark',
    () => {
      const t = focusedTweet
      if (t) void unbookmarkTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unfollow',
    () => {
      const t = focusedTweet
      if (t) void unfollowUser(t.author.screenName)
    },
    { context: 'List' },
  )
  useKeybinding('list:down', () => scrollBy(SCROLL_STEP), { context: 'List' })
  useKeybinding('list:up', () => scrollBy(-SCROLL_STEP), { context: 'List' })
  useKeybinding('list:pageDown', () => scrollPage(1), { context: 'List' })
  useKeybinding('list:pageUp', () => scrollPage(-1), { context: 'List' })
  useKeybinding('list:top', scrollToTop, { context: 'List' })
  useKeybinding('list:bottom', scrollToBottom, { context: 'List' })
  useKeybinding('list:open', openFocused, { context: 'List' })
  useKeybinding('list:media', currentOr(actions.onMedia), { context: 'List' })
  useKeybinding('list:like', currentOr(actions.onLike), { context: 'List' })
  useKeybinding('list:retweet', currentOr(actions.onRetweet), { context: 'List' })
  useKeybinding('list:bookmark', currentOr(actions.onBookmark), { context: 'List' })
  useKeybinding('list:reply', currentOr(actions.onReply), { context: 'List' })
  useKeybinding('list:quote', currentOr(actions.onQuote), { context: 'List' })
  useKeybinding('list:follow', currentOr(actions.onFollow), { context: 'List' })
  useKeybinding('list:copyLink', currentOr(actions.onCopyLink), { context: 'List' })
  useKeybinding('list:copyText', currentOr(actions.onCopyText), { context: 'List' })
  useKeybinding('app:refresh', () => void load(), { context: 'Global' })

  if (loading && !entry) {
    return (
      <Box padding={2}>
        <LoadingLine label={`Loading tweet ${id}`} />
      </Box>
    )
  }
  if (error && !entry) {
    return (
      <Box padding={2} flexDirection="column" gap={1}>
        <Text color="error">Error: {error}</Text>
        <Text color={TW_DIM}>Press Ctrl+R to retry or Esc to go back.</Text>
      </Box>
    )
  }
  if (!entry) return null

  return (
    <Box flexDirection="column" flexGrow={1}>
      <ScrollBox ref={scrollRef} flexDirection="column" flexGrow={1}>
        <Box paddingX={2} paddingTop={1}>
          <Text color={TW_BLUE} bold>
            Tweet
          </Text>
        </Box>
        <Box
          ref={el => {
            cardRefs.current[0] = el
          }}
          flexShrink={0}
          flexDirection="column"
          borderStyle="single"
          borderTop={false}
          borderLeft={false}
          borderRight={false}
        >
          <TweetCard
            tweet={entry.tweet}
            isFocused={focused === 0}
            onOpen={openTweet}
            onProfile={actions.onProfile}
          />
        </Box>
        <Box paddingX={2} paddingY={1} flexDirection="row" gap={1}>
          <Text color={TW_DIM}>Replies · {replies.length}</Text>
          {loading ? (
            <>
              <Spinner />
              <Text color={TW_DIM}>refreshing</Text>
            </>
          ) : null}
        </Box>
        {replies.map((tweet, i) => (
          <Box
            key={tweet.id}
            ref={el => {
              cardRefs.current[i + 1] = el
            }}
            flexShrink={0}
            flexDirection="column"
          >
            <TweetCard
              tweet={tweet}
              isFocused={focused === i + 1}
              onOpen={openTweet}
              onProfile={actions.onProfile}
            />
          </Box>
        ))}
        {error ? (
          <Box paddingX={2} paddingBottom={1} flexDirection="column" gap={1}>
            <Text color="error">Error: {error}</Text>
            <Text color={TW_DIM}>Press Ctrl+R to retry.</Text>
          </Box>
        ) : null}
        {!loading && replies.length === 0 ? (
          <Box paddingX={2} paddingBottom={1}>
            <Text color={TW_DIM}>No replies yet.</Text>
          </Box>
        ) : null}
      </ScrollBox>
    </Box>
  )
}
