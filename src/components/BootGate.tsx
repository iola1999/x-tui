import React from 'react'
import { Box, Text } from '@anthropic/ink'
import { type BootError, useStore } from '../state/store.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

/**
 * Content for each BootError kind. Exported so tests can pin the shape
 * without mounting Ink.
 */
export function bootErrorContent(err: BootError): {
  icon: string
  title: string
  body: string[]
  /** Secondary hint line (Ctrl+R etc.). */
  retryHint: string
} {
  switch (err.kind) {
    case 'cliMissing':
      return {
        icon: '🔎',
        title: 'twitter CLI not found on PATH',
        body: [
          'x-tui shells out to the `twitter` CLI for every request. It looks',
          'like you don\'t have it installed (or it isn\'t on $PATH).',
          '',
          'Install with one of:',
          '  uv tool install twitter-cli',
          '  pipx install twitter-cli',
          '  brew install jackwener/tap/twitter-cli',
          '',
          'Then run `twitter auth login` to sign in.',
        ],
        retryHint: 'Press Ctrl+R to re-check after installing.',
      }
    case 'notLoggedIn':
      return {
        icon: '🔒',
        title: 'Not signed in',
        body: [
          'The twitter CLI is installed but has no active session.',
          '',
          'Run in another shell:',
          '  twitter auth login',
          '',
          'Then come back here and press Ctrl+R to reload.',
        ],
        retryHint: 'Ctrl+R once signed in.',
      }
    case 'other':
      return {
        icon: '⚠',
        title: 'twitter CLI request failed',
        body: [err.message || 'Unknown error.', '', 'Check your network, then retry.'],
        retryHint: 'Press Ctrl+R to retry.',
      }
  }
}

/**
 * Wraps the active screen. When the boot probe (or any screen) sets a
 * bootError, we replace the screen body with a friendly onboarding panel
 * tailored to the kind (cliMissing / notLoggedIn / other). The shell's
 * global keybindings still work, so the user can switch tabs or quit.
 */
export function BootGate({ children }: { children: React.ReactNode }): React.ReactNode {
  const err = useStore(s => s.bootError)
  if (!err) return <>{children}</>
  const { icon, title, body, retryHint } = bootErrorContent(err)
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} padding={2}>
      <Text color={TW_BLUE} bold>
        {icon} {title}
      </Text>
      <Box marginTop={1} flexDirection="column" alignItems="flex-start">
        {body.map((line, i) => (
          <Text key={i} color={line.startsWith('  ') ? TW_BLUE : undefined}>
            {line || ' '}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={TW_DIM}>{retryHint}</Text>
      </Box>
    </Box>
  )
}
