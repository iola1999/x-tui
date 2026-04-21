#!/usr/bin/env bun
import React from 'react'
import { wrappedRender as render, AlternateScreen, Box, Text, ThemeProvider } from '@anthropic/ink'
import { isFullscreenActive, isMouseTrackingEnabled } from '../utils/fullscreen.js'

function HelloApp() {
  return (
    <AlternateScreen mouseTracking={isMouseTrackingEnabled()}>
      <Box flexDirection="column" width="100%" height="100%" padding={1}>
        <Text color="claude" bold>x-tui — smoke test</Text>
        <Text dimColor>Ctrl+C to quit · mouse tracking: {isMouseTrackingEnabled() ? 'on' : 'off'}</Text>
      </Box>
    </AlternateScreen>
  )
}

async function main(): Promise<void> {
  if (!isFullscreenActive()) {
    console.log('x-tui: not in an interactive terminal (or X_TUI_NO_FLICKER=0); printing and exiting.')
    return
  }
  await render(
    <ThemeProvider>
      <HelloApp />
    </ThemeProvider>,
  )
}

void main()
