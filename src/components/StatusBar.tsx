import React from 'react'
import { Box, Text } from '@anthropic/ink'
import { currentScreen, useStore } from '../state/store.js'
import { TW_BLUE, TW_DIM, TW_SUBTLE } from '../theme/twitterTheme.js'

function screenLabel(): string {
  const s = currentScreen()
  switch (s.kind) {
    case 'feed':
      return 'Home timeline'
    case 'search':
      return 'Search'
    case 'bookmarks':
      return 'Bookmarks'
    case 'profile':
      return s.handle ? `@${s.handle}` : 'Profile'
    case 'tweet':
      return `Tweet ${s.id}`
    case 'imageViewer':
      return `Image ${s.index + 1} / ${s.urls.length}`
    case 'compose':
      return s.mode.kind === 'reply'
        ? `Reply to @${s.mode.inReplyTo.author}`
        : s.mode.kind === 'quote'
          ? `Quote @${s.mode.quoted.author}`
          : 'Compose'
    case 'help':
      return 'Help'
  }
}

const KEY_HINTS = 'j/k move · ⏎ open · / search · ? help · q quit'

export function StatusBar(): React.ReactNode {
  const toast = useStore(s => s.toasts.at(-1) ?? null)
  const label = screenLabel()

  return (
    <Box
      flexShrink={0}
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderStyle="single"
      borderColor={TW_SUBTLE}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      <Box flexDirection="row" gap={1}>
        <Text color={TW_BLUE} bold>
          {label}
        </Text>
        {toast && (
          <Text
            color={toast.kind === 'error' ? 'error' : toast.kind === 'success' ? 'success' : TW_BLUE}
          >
            · {toast.text}
          </Text>
        )}
      </Box>
      <Text color={TW_DIM}>{KEY_HINTS}</Text>
    </Box>
  )
}
