import React, { useCallback } from 'react'
import { Box, Text, useKeybinding } from '@anthropic/ink'
import { bookmarks } from '../services/twitterCli.js'
import { TweetList } from '../components/TweetList.js'
import {
  mutateTweetEverywhere,
  setFocusedIndex,
  useListData,
} from '../state/listCache.js'
import { TW_DIM } from '../theme/twitterTheme.js'
import {
  makeTweetActions,
  unbookmarkTweet,
  unfollowUser,
  unlikeTweet,
  unretweetTweet,
} from '../services/tweetActions.js'

const KEY = 'bookmarks'
const INITIAL_MAX = 30

const fetchBookmarks = () => bookmarks({ max: INITIAL_MAX })

export function BookmarksScreen(): React.ReactNode {
  const { entry, loading, error, refresh } = useListData(KEY, fetchBookmarks)
  const tweets = entry?.tweets ?? []

  const mutator = React.useCallback(
    (id: string, upd: Parameters<typeof mutateTweetEverywhere>[1]) =>
      mutateTweetEverywhere(id, upd),
    [],
  )
  const actions = React.useMemo(() => makeTweetActions(mutator), [mutator])

  const onFocusChange = useCallback((i: number) => setFocusedIndex(KEY, i), [])
  const focused = entry?.focusedIndex ?? 0
  useKeybinding(
    'list:unlike',
    () => {
      const t = tweets[focused]
      if (t) void unlikeTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unretweet',
    () => {
      const t = tweets[focused]
      if (t) void unretweetTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unbookmark',
    () => {
      const t = tweets[focused]
      if (t) void unbookmarkTweet(t.id, mutator)
    },
    { context: 'List' },
  )
  useKeybinding(
    'list:unfollow',
    () => {
      const t = tweets[focused]
      if (t) void unfollowUser(t.author.screenName)
    },
    { context: 'List' },
  )

  const cachedAge = entry ? Math.floor((Date.now() - entry.fetchedAt) / 1000) : null

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={2} paddingTop={1} paddingBottom={1}>
        <Text color={TW_DIM}>
          Bookmarks · {tweets.length}
          {loading ? ' · loading…' : cachedAge !== null ? ` · ${cachedAge}s ago` : ''}
        </Text>
      </Box>
      <TweetList
        tweets={tweets}
        loading={loading}
        error={error && tweets.length === 0 ? error : null}
        focusedIndex={focused}
        onFocusChange={onFocusChange}
        emptyMessage="You haven't bookmarked anything."
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
        onRefresh={refresh}
      />
    </Box>
  )
}
