import React from 'react'
import { Box, Text } from '@anthropic/ink'
import type { Author as AuthorType } from '../types/tweet.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

/**
 * Single-line author rendering: display name · @handle · verified badge.
 * Click on the box opens that user's profile (onProfile supplied by parent).
 */
export function Author({
  author,
  onProfile,
}: {
  author: AuthorType
  onProfile?: (screenName: string) => void
}): React.ReactNode {
  const openProfile = onProfile ? () => onProfile(author.screenName) : undefined
  return (
    <Box flexDirection="row" flexShrink={0}>
      <Box onClick={openProfile}>
        <Text bold>{author.name}</Text>
      </Box>
      {author.verified && (
        <Text color={TW_BLUE}>{' ✓'}</Text>
      )}
      <Text color={TW_DIM}>
        {' '}
        <Text>@{author.screenName}</Text>
      </Text>
    </Box>
  )
}
