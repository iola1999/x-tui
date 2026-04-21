import React from 'react'
import { Box, Text } from '@anthropic/ink'
import { TW_DIM } from '../theme/twitterTheme.js'

/** Thin placeholder screen used while Phase 3+ implements real data. */
export function PlaceholderScreen({
  title,
  body,
}: {
  title: string
  body?: string
}): React.ReactNode {
  return (
    <Box flexDirection="column" padding={2}>
      <Text bold>{title}</Text>
      {body && (
        <Box marginTop={1}>
          <Text color={TW_DIM}>{body}</Text>
        </Box>
      )}
    </Box>
  )
}
