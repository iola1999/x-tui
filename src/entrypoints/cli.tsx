#!/usr/bin/env bun
import React from 'react'
import { wrappedRender as render } from '@anthropic/ink'
import { App } from '../App.js'
import { isFullscreenActive } from '../utils/fullscreen.js'

async function main(): Promise<void> {
  if (!isFullscreenActive()) {
    console.log(
      'x-tui requires an interactive terminal. ' +
        'Set X_TUI_NO_FLICKER=0 to debug in scrollback mode (not yet implemented).',
    )
    process.exitCode = 1
    return
  }

  const instance = await render(<App onExit={() => instance.unmount()} />, {
    exitOnCtrlC: false, // we handle Ctrl+C via app:quit keybinding
    patchConsole: true,
  })

  await instance.waitUntilExit()
}

void main()
