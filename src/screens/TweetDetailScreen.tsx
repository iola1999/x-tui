import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Text, useKeybinding, useRegisterKeybindingContext } from '@anthropic/ink'
import { tweetDetail, tweetHead } from '../services/twitterCli.js'
import type { Tweet } from '../types/tweet.js'
import { TweetCard } from '../components/TweetCard.js'
import { TweetList } from '../components/TweetList.js'
import { LoadingLine, Spinner } from '../components/Spinner.js'
import { mutateTweetEverywhere, setFocusedIndex } from '../state/listCache.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'
import {
  makeTweetActions,
  unbookmarkTweet,
  unfollowUser,
  unlikeTweet,
  unretweetTweet,
} from '../services/tweetActions.js'

/**
 * Single tweet + replies. Uses a small in-memory cache separate from listCache
 * (because the shape is tweet + replies[], not a flat list). Still uses
 * listCache for the replies list so mutations propagate across the app.
 */
type DetailEntry = {
  tweet: Tweet
  replies: Tweet[]
  tweetFetchedAt: number
  repliesFetchedAt?: number
}

const detailCache = new Map<string, DetailEntry>()
const detailListeners = new Map<string, Set<() => void>>()

function notifyDetail(id: string): void {
  const set = detailListeners.get(id)
  if (set) for (const l of set) l()
}

export function TweetDetailScreen({ id }: { id: string }): React.ReactNode {
  useRegisterKeybindingContext('List', true)
  const [, forceRerender] = useState(0)
  const [loading, setLoading] = useState(() => !detailCache.get(id)?.tweet)
  const [error, setError] = useState<string | null>(null)

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
  const repliesKey = `replies:${id}`
  const replies = entry?.replies ?? []
  const [focused, setFocused] = useState(0)
  useEffect(() => {
    setFocusedIndex(repliesKey, focused)
  }, [repliesKey, focused])

  useKeybinding(
    'list:unlike',
    () => {
      const t = replies[focused] ?? entry?.tweet
      if (t) void unlikeTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unretweet',
    () => {
      const t = replies[focused] ?? entry?.tweet
      if (t) void unretweetTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unbookmark',
    () => {
      const t = replies[focused] ?? entry?.tweet
      if (t) void unbookmarkTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unfollow',
    () => {
      const t = entry?.tweet
      if (t) void unfollowUser(t.author.screenName)
    },
    { context: 'List' },
  )

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
      <Box paddingX={2} paddingTop={1}>
        <Text color={TW_BLUE} bold>
          Tweet
        </Text>
      </Box>
      <Box flexShrink={0} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false}>
        <TweetCard tweet={entry.tweet} isFocused={false} onOpen={undefined} onProfile={actions.onProfile} />
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
      <TweetList
        tweets={replies}
        loading={loading}
        error={error ?? null}
        focusedIndex={focused}
        onFocusChange={setFocused}
        emptyMessage="No replies yet."
        onOpen={actions.onOpen}
        onProfile={actions.onProfile}
        onMedia={actions.onMedia}
        onLike={actions.onLike}
        onRetweet={actions.onRetweet}
        onBookmark={actions.onBookmark}
        onReply={actions.onReply}
        onQuote={actions.onQuote}
        onFollow={actions.onFollow}
        onCopyLink={actions.onCopyLink}
        onCopyText={actions.onCopyText}
        onRefresh={() => void load()}
      />
    </Box>
  )
}
