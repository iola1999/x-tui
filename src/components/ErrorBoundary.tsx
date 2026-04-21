import React from 'react'
import { Box, Text } from '@anthropic/ink'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

type Props = {
  children: React.ReactNode
  /** Invoked when the user presses the retry affordance — usually "pop and reload". */
  onReset?: () => void
}

type State = {
  error: Error | null
  /** Monotonically-increasing key; bump to force the subtree to re-mount. */
  resetKey: number
}

/**
 * Top-level React error boundary so a render-time crash in a single screen
 * (e.g. a backfilled tweet with missing fields, a bad image buffer) doesn't
 * blank out the whole app. We render a compact error card; the user can
 * press Esc/Ctrl+R at the Global keybinding layer to navigate out.
 *
 * Borrowed from claude-code's SentryErrorBoundary pattern — minus the
 * telemetry plumbing, which is out of scope for a local-only TUI.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Write to stderr (ink's patchConsole routes this safely) so the
    // transcript carries the trace even though the UI only shows a summary.
    // eslint-disable-next-line no-console
    console.error('[x-tui] render error:', error, info.componentStack)
  }

  reset = (): void => {
    this.props.onReset?.()
    this.setState(s => ({ error: null, resetKey: s.resetKey + 1 }))
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column" padding={2} gap={1}>
          <Text color="error" bold>
            ✗ Something broke while rendering this screen.
          </Text>
          <Text color={TW_DIM}>{this.state.error.message}</Text>
          <Text color={TW_BLUE}>Press Esc to go back, Ctrl+R to reload.</Text>
        </Box>
      )
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
  }
}
