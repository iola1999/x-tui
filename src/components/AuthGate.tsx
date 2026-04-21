import React from 'react'
import { Box, Text } from '@anthropic/ink'
import { useStore } from '../state/store.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

/**
 * Wraps the active screen. When the twitter CLI reported an auth error, we
 * replace the screen body with a friendly dialog instead. The user can still
 * switch tabs / quit (those keybindings live above in the shell).
 */
export function AuthGate({ children }: { children: React.ReactNode }): React.ReactNode {
  const err = useStore(s => s.authError)
  if (!err) return <>{children}</>
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} padding={2}>
      <Text color={TW_BLUE} bold>
        🔒 Not signed in
      </Text>
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text>{err}</Text>
        <Text color={TW_DIM}>
          Run <Text bold>twitter auth login</Text> in another shell, then press Ctrl+R.
        </Text>
      </Box>
    </Box>
  )
}
