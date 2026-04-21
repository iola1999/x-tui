import React, { useCallback, useEffect, useState } from 'react'
import { Box, Text, useKeybinding } from '@anthropic/ink'
import { userPosts, userProfile, whoami } from '../services/twitterCli.js'
import type { UserResponse } from '../types/tweet.js'
import { TweetList } from '../components/TweetList.js'
import {
  mutateTweetEverywhere,
  setFocusedIndex,
  useListData,
} from '../state/listCache.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'
import { compactNumber } from '../utils/time.js'
import {
  makeTweetActions,
  unbookmarkTweet,
  unfollowUser,
  unlikeTweet,
  unretweetTweet,
} from '../services/tweetActions.js'

type User = UserResponse['data']['user']

function UserHeader({ user }: { user: User }): React.ReactNode {
  return (
    <Box flexDirection="column" paddingX={2} paddingTop={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold>{user.name}</Text>
        {user.verified && <Text color={TW_BLUE}>✓</Text>}
        <Text color={TW_DIM}>@{user.screenName}</Text>
      </Box>
      {user.bio ? (
        <Box marginTop={0}>
          <Text>{user.bio}</Text>
        </Box>
      ) : null}
      <Box marginTop={0} flexDirection="row" gap={2}>
        {user.location ? <Text color={TW_DIM}>📍 {user.location}</Text> : null}
        {user.url ? <Text color={TW_DIM}>🔗 {user.url}</Text> : null}
      </Box>
      <Box marginTop={0} flexDirection="row" gap={3}>
        <Text>
          <Text bold>{compactNumber(user.following ?? 0)}</Text>
          <Text color={TW_DIM}> Following</Text>
        </Text>
        <Text>
          <Text bold>{compactNumber(user.followers ?? 0)}</Text>
          <Text color={TW_DIM}> Followers</Text>
        </Text>
        {user.tweets !== undefined && (
          <Text>
            <Text bold>{compactNumber(user.tweets)}</Text>
            <Text color={TW_DIM}> Tweets</Text>
          </Text>
        )}
      </Box>
    </Box>
  )
}

export function UserProfileScreen({ handle }: { handle?: string }): React.ReactNode {
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(handle ?? null)
  const [user, setUser] = useState<User | null>(null)
  const [userError, setUserError] = useState<string | null>(null)

  // Bootstrapping: when no handle is given, resolve "me" via whoami.
  useEffect(() => {
    let cancelled = false
    if (handle) {
      setResolvedHandle(handle)
      void userProfile(handle)
        .then(u => {
          if (!cancelled) {
            setUser(u)
            setUserError(null)
          }
        })
        .catch(e => {
          if (!cancelled) setUserError((e as Error).message)
        })
    } else {
      void whoami()
        .then(u => {
          if (!cancelled) {
            setUser(u)
            setResolvedHandle(u.screenName)
            setUserError(null)
          }
        })
        .catch(e => {
          if (!cancelled) setUserError((e as Error).message)
        })
    }
    return () => {
      cancelled = true
    }
  }, [handle])

  // Posts list — only kicks off once we know the handle.
  const listKey = resolvedHandle ? `user-posts:${resolvedHandle}` : null
  const fetcher = useCallback(() => {
    if (!resolvedHandle) return Promise.resolve({ tweets: [], nextCursor: undefined })
    return userPosts(resolvedHandle, { max: 30 })
  }, [resolvedHandle])

  const { entry, loading, error, refresh } = useListData(listKey ?? 'user-posts:__pending__', fetcher)
  const tweets = listKey ? entry?.tweets ?? [] : []
  const focused = listKey ? entry?.focusedIndex ?? 0 : 0

  const mutator = useCallback(
    (id: string, upd: Parameters<typeof mutateTweetEverywhere>[1]) =>
      mutateTweetEverywhere(id, upd),
    [],
  )
  const actions = React.useMemo(() => makeTweetActions(mutator), [mutator])

  const onFocusChange = useCallback((i: number) => {
    if (listKey) setFocusedIndex(listKey, i)
  }, [listKey])

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
      if (resolvedHandle) void unfollowUser(resolvedHandle)
    },
    { context: 'List' },
  )

  return (
    <Box flexDirection="column" flexGrow={1}>
      {userError ? (
        <Box padding={2}>
          <Text color="error">Couldn't load profile: {userError}</Text>
        </Box>
      ) : user ? (
        <UserHeader user={user} />
      ) : (
        <Box padding={2}>
          <Text color={TW_DIM}>Loading profile…</Text>
        </Box>
      )}
      <Box paddingX={2} paddingY={1}>
        <Text color={TW_DIM}>
          Latest tweets · {tweets.length}
          {loading ? ' · loading…' : ''}
        </Text>
      </Box>
      <TweetList
        tweets={tweets}
        loading={loading}
        error={error && tweets.length === 0 ? error : null}
        focusedIndex={focused}
        onFocusChange={onFocusChange}
        emptyMessage="No tweets yet."
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
