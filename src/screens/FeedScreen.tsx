import React, { useCallback } from 'react'
import { Box, Text } from '@anthropic/ink'
import { feed, TwitterCliError } from '../services/twitterCli.js'
import { TweetList } from '../components/TweetList.js'
import { Spinner } from '../components/Spinner.js'
import {
  mutateTweetEverywhere,
  setFocusedIndex,
  useListData,
} from '../state/listCache.js'
import { setAuthError } from '../state/store.js'
import { TW_DIM } from '../theme/twitterTheme.js'
import {
  makeTweetActions,
  unbookmarkTweet,
  unfollowUser,
  unlikeTweet,
  unretweetTweet,
} from '../services/tweetActions.js'
import { useKeybinding } from '@anthropic/ink'

const KEY = 'feed'
const INITIAL_MAX = 30

const fetchFeed = () => feed({ max: INITIAL_MAX })

export function FeedScreen(): React.ReactNode {
  const { entry, loading, error, refresh } = useListData(KEY, fetchFeed)

  const tweets = entry?.tweets ?? []

  // Surface auth errors to the shell once, so the rest of the list renders
  // whatever partial state the cache holds.
  React.useEffect(() => {
    if (error && /not (?:logged|authenticated)|401/i.test(error)) {
      setAuthError('Not logged in. Run `twitter auth login` in another shell.')
    }
  }, [error])

  const actions = React.useMemo(
    () => makeTweetActions((id, upd) => mutateTweetEverywhere(id, upd)),
    [],
  )

  const onFocusChange = useCallback((i: number) => setFocusedIndex(KEY, i), [])
  const onShiftLike = useCallback(() => {
    const t = tweets[entry?.focusedIndex ?? 0]
    if (t) void unlikeTweet(t.id, (id, upd) => mutateTweetEverywhere(id, upd))
  }, [tweets, entry?.focusedIndex])
  const onShiftRetweet = useCallback(() => {
    const t = tweets[entry?.focusedIndex ?? 0]
    if (t) void unretweetTweet(t.id, (id, upd) => mutateTweetEverywhere(id, upd))
  }, [tweets, entry?.focusedIndex])
  const onShiftBookmark = useCallback(() => {
    const t = tweets[entry?.focusedIndex ?? 0]
    if (t) void unbookmarkTweet(t.id, (id, upd) => mutateTweetEverywhere(id, upd))
  }, [tweets, entry?.focusedIndex])
  const onShiftFollow = useCallback(() => {
    const t = tweets[entry?.focusedIndex ?? 0]
    if (t) void unfollowUser(t.author.screenName)
  }, [tweets, entry?.focusedIndex])
  useKeybinding('list:unlike', onShiftLike, { context: 'List' })
  useKeybinding('list:unretweet', onShiftRetweet, { context: 'List' })
  useKeybinding('list:unbookmark', onShiftBookmark, { context: 'List' })
  useKeybinding('list:unfollow', onShiftFollow, { context: 'List' })

  const cachedAge = entry ? Math.floor((Date.now() - entry.fetchedAt) / 1000) : null

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={2} paddingTop={1} paddingBottom={1} flexDirection="row" gap={1}>
        <Text color={TW_DIM}>Home timeline · {tweets.length} tweets</Text>
        {loading ? (
          <>
            <Spinner />
            <Text color={TW_DIM}>refreshing</Text>
          </>
        ) : cachedAge !== null ? (
          <Text color={TW_DIM}>· {cachedAge}s ago</Text>
        ) : null}
        {error && tweets.length > 0 ? <Text color="error">· stale ({error})</Text> : null}
      </Box>
      <TweetList
        tweets={tweets}
        loading={loading}
        error={error && tweets.length === 0 ? error : null}
        focusedIndex={entry?.focusedIndex ?? 0}
        onFocusChange={onFocusChange}
        emptyMessage="No tweets on your timeline yet."
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

// TypeScript narrowing for the optional handler destructure above.
void TwitterCliError
