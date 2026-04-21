import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Text,
  useInput,
  useKeybinding,
  useRegisterKeybindingContext,
} from '@anthropic/ink'
import { search as runSearch } from '../services/twitterCli.js'
import { TweetList } from '../components/TweetList.js'
import { Spinner } from '../components/Spinner.js'
import {
  mutateTweetEverywhere,
  setFocusedIndex,
  useListData,
} from '../state/listCache.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'
import {
  makeTweetActions,
  unbookmarkTweet,
  unfollowUser,
  unlikeTweet,
  unretweetTweet,
} from '../services/tweetActions.js'

type Filters = {
  tab: 'Top' | 'Latest'
  hasImages: boolean
  hasLinks: boolean
}

const DEFAULT_FILTERS: Filters = { tab: 'Latest', hasImages: false, hasLinks: false }

function filterKey(f: Filters): string {
  return `${f.tab}|${f.hasImages ? 'i' : ''}${f.hasLinks ? 'l' : ''}`
}

export function SearchScreen(): React.ReactNode {
  useRegisterKeybindingContext('Search', true)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [inputting, setInputting] = useState(true)
  const queryRef = useRef(query)
  queryRef.current = query

  const listKey = query ? `search:${query}|${filterKey(filters)}` : null

  const fetcher = useCallback(
    () =>
      query
        ? runSearch(query, {
            tab: filters.tab,
            max: 30,
            hasImages: filters.hasImages,
            hasLinks: filters.hasLinks,
          })
        : Promise.resolve({ tweets: [], nextCursor: undefined }),
    [query, filters],
  )

  const { entry, loading, error, refresh } = useListData(
    listKey ?? 'search:__empty__',
    fetcher,
    { ttl: 30_000 },
  )
  const tweets = listKey ? entry?.tweets ?? [] : []
  const focused = listKey ? entry?.focusedIndex ?? 0 : 0

  // Text input for the query. `/` re-enters the input; Enter submits; Esc
  // leaves the input (so list keybindings take over).
  useInput(
    (input, key, event) => {
      if (!inputting) return
      if (key.escape) {
        setInputting(false)
        event.stopImmediatePropagation()
        return
      }
      if (key.return) {
        setInputting(false)
        event.stopImmediatePropagation()
        return
      }
      if (key.backspace || key.delete) {
        setQuery(q => q.slice(0, -1))
        event.stopImmediatePropagation()
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setQuery(q => q + input)
        event.stopImmediatePropagation()
      }
    },
    { isActive: inputting },
  )

  useKeybinding('list:search', () => setInputting(true), { context: 'List' })
  useKeybinding('list:search', () => setInputting(true), { context: 'Search' })

  const mutator = useCallback(
    (id: string, upd: Parameters<typeof mutateTweetEverywhere>[1]) => mutateTweetEverywhere(id, upd),
    [],
  )
  const actions = React.useMemo(() => makeTweetActions(mutator), [mutator])
  const onFocusChange = useCallback(
    (i: number) => {
      if (listKey) setFocusedIndex(listKey, i)
    },
    [listKey],
  )

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

  // Quick filter toggles from the search screen when NOT typing.
  useEffect(() => {
    // no-op — we rely on manual key handling via useInput for filter hotkeys.
  }, [])

  // Filter hotkeys (when not typing): 1=Latest/Top flip, I=images, L=links.
  useInput(
    (input, key) => {
      if (inputting) return
      if (key.ctrl || key.meta) return
      if (input === 'T' || input === 't') {
        setFilters(f => ({ ...f, tab: f.tab === 'Latest' ? 'Top' : 'Latest' }))
      } else if (input === 'I') {
        setFilters(f => ({ ...f, hasImages: !f.hasImages }))
      } else if (input === 'L') {
        setFilters(f => ({ ...f, hasLinks: !f.hasLinks }))
      }
    },
    { isActive: !inputting },
  )

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={2} paddingTop={1} flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color={TW_BLUE} bold>
            {inputting ? '› ' : '/ '}
          </Text>
          <Text>{query || (inputting ? '…type a query, Enter to search' : '(no query)')}</Text>
          {inputting && <Text color={TW_BLUE}>▍</Text>}
        </Box>
        <Box flexDirection="row" gap={2} marginTop={1}>
          <Text color={filters.tab === 'Latest' ? TW_BLUE : TW_DIM}>
            [T] {filters.tab === 'Latest' ? 'Latest' : 'Top'}
          </Text>
          <Text color={filters.hasImages ? TW_BLUE : TW_DIM}>
            [I] images{filters.hasImages ? ' ✓' : ''}
          </Text>
          <Text color={filters.hasLinks ? TW_BLUE : TW_DIM}>
            [L] links{filters.hasLinks ? ' ✓' : ''}
          </Text>
          <Text color={TW_DIM}>· Enter/Esc leaves input · / re-enters</Text>
        </Box>
      </Box>
      <Box paddingX={2} paddingY={1} flexDirection="row" gap={1}>
        {listKey ? (
          <>
            <Text color={TW_DIM}>{tweets.length} results</Text>
            {loading ? (
              <>
                <Spinner />
                <Text color={TW_DIM}>searching</Text>
              </>
            ) : null}
          </>
        ) : (
          <Text color={TW_DIM}>Type a query then Enter.</Text>
        )}
      </Box>
      {listKey ? (
        <TweetList
          tweets={tweets}
          loading={loading}
          error={error && tweets.length === 0 ? error : null}
          focusedIndex={focused}
          onFocusChange={onFocusChange}
          emptyMessage={`No tweets match "${query}".`}
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
      ) : null}
    </Box>
  )
}
