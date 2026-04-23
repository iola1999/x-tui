import React, { useState } from 'react'
import { Box, Text } from '@anthropic/ink'
import type { Tweet } from '../types/tweet.js'
import { Author } from './Author.js'
import { MediaThumbs } from './MediaThumbs.js'
import { TweetText } from './TweetText.js'
import { TW_BLUE, TW_DIM, TW_LIKE, TW_RETWEET, TW_SUBTLE } from '../theme/twitterTheme.js'
import { compactNumber, formatRelative } from '../utils/time.js'

type Props = {
  tweet: Tweet | undefined | null
  isFocused?: boolean
  onOpen?: (t: Tweet) => void
  onMedia?: (t: Tweet, photoIndex?: number) => void
  onProfile?: (screenName: string) => void
}

function MediaBadge({ tweet }: { tweet: Tweet }): React.ReactNode {
  if (!tweet.media?.length) return null
  const counts = tweet.media.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1
    return acc
  }, {})
  const parts = Object.entries(counts).map(([kind, n]) => {
    const icon = kind === 'photo' ? '📷' : kind === 'video' ? '🎥' : '📎'
    return `${icon} ${kind}${n > 1 ? ` ×${n}` : ''}`
  })
  return (
    <Text color={TW_DIM}>
      {parts.join('  ')}
    </Text>
  )
}

function MetricsRow({ tweet }: { tweet: Tweet }): React.ReactNode {
  const m = tweet.metrics ?? { replies: 0, retweets: 0, likes: 0, bookmarks: 0, views: 0, quotes: 0 }
  return (
    <Box flexDirection="row" gap={2}>
      <Text color={TW_DIM}>💬 {compactNumber(m.replies)}</Text>
      <Text color={TW_RETWEET}>🔁 {compactNumber(m.retweets)}</Text>
      <Text color={TW_LIKE}>♥ {compactNumber(m.likes)}</Text>
      <Text color={TW_BLUE}>🔖 {compactNumber(m.bookmarks)}</Text>
      <Text color={TW_DIM}>👁 {compactNumber(m.views)}</Text>
    </Box>
  )
}

/**
 * One tweet card. Two border levels:
 *   isFocused (keyboard) → blue left accent
 *   hover (mouse)        → subtle left accent
 *   otherwise            → transparent left accent (still reserves width for stable layout)
 */
export function TweetCard({ tweet, isFocused, onOpen, onMedia, onProfile }: Props): React.ReactNode {
  const [hovered, setHovered] = useState(false)
  if (!tweet || !tweet.author) {
    // Defensive: listCache / detail fetches sometimes hand us partial entries
    // (e.g. a reply placeholder from a backfill). Render nothing rather than
    // crash the whole screen.
    return null
  }
  const accent = isFocused ? TW_BLUE : hovered ? TW_SUBTLE : 'rgb(0,0,0)'
  const time = formatRelative(tweet.createdAtISO) || tweet.createdAtLocal || ''

  const open = onOpen ? () => onOpen(tweet) : undefined

  return (
    <Box flexDirection="row" width="100%" paddingY={0} paddingX={0}>
      {/* Left 2-col focus accent. We paint an entire column of bg color so the
          focus ring reads cleanly even on multi-line tweets. */}
      <Box flexShrink={0} width={2} paddingRight={1}>
        <Text color={accent}>{isFocused || hovered ? '│ ' : '  '}</Text>
      </Box>
      <Box
        flexDirection="column"
        flexGrow={1}
        onClick={open}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        paddingRight={1}
        paddingBottom={1}
      >
        <Box flexDirection="row" justifyContent="space-between">
          <Author author={tweet.author} onProfile={onProfile} />
          <Text color={TW_DIM}>{time}</Text>
        </Box>
        <Box marginTop={0}>
          <TweetText text={tweet.text} onMention={onProfile} />
        </Box>
        {tweet.media?.length ? (
          <MediaThumbs
            media={tweet.media}
            onOpen={photoIndex => {
              onMedia?.(tweet, photoIndex)
            }}
          />
        ) : null}
        <Box marginTop={0}>
          <MetricsRow tweet={tweet} />
        </Box>
      </Box>
    </Box>
  )
}
