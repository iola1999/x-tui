#!/usr/bin/env bun
import React from 'react'
import { wrappedRender as render } from '@anthropic/ink'
import { onExit } from 'signal-exit'
import { appendFileSync } from 'node:fs'
import { App } from '../App.js'
import { isFullscreenActive } from '../utils/fullscreen.js'

const DEBUG_SHUTDOWN = process.env.X_TUI_DEBUG_SHUTDOWN === '1'
const shutdownT0 = Date.now()
function shutdownLog(msg: string): void {
  if (!DEBUG_SHUTDOWN) return
  try {
    appendFileSync(
      '/tmp/x-tui-shutdown.log',
      `+${Date.now() - shutdownT0}ms ${msg}\n`,
    )
  } catch {
    // best-effort
  }
}
shutdownLog('module-loaded')

onExit(() => {
  shutdownLog('signal-exit-pin-fired')
})

async function main(): Promise<void> {
  if (!isFullscreenActive()) {
    console.log(
      'x-tui requires an interactive terminal. ' +
        'Set X_TUI_NO_FLICKER=0 to debug in scrollback mode (not yet implemented).',
    )
    process.exitCode = 1
    return
  }

  let instance: Awaited<ReturnType<typeof render>> | null = null
  let shuttingDown = false
  const shutdown = (code: number, reason: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    shutdownLog(`shutdown-start reason=${reason} code=${code}`)
    try {
      instance?.unmount()
      shutdownLog('shutdown-after-unmount')
    } catch (e) {
      shutdownLog(`shutdown-unmount-threw: ${(e as Error).message}`)
    }
    shutdownLog('shutdown-calling-process-exit')
    // Direct process.exit — no microtask detour. Ink's unmount already ran
    // writeSync() for all terminal resets (EXIT_ALT_SCREEN, SHOW_CURSOR,
    // DISABLE_MOUSE_TRACKING, …) synchronously; anything else on the event
    // loop (undici pools, spawn stdout readers, toast timers) only delays
    // the exit.
    process.exit(code)
  }

  process.once('SIGTERM', () => shutdown(143, 'SIGTERM'))
  process.once('SIGHUP', () => shutdown(129, 'SIGHUP'))
  process.once('SIGINT', () => shutdown(130, 'SIGINT'))
  process.on('uncaughtException', err => {
    // eslint-disable-next-line no-console
    console.error('\nx-tui crashed:', err)
    shutdown(1, 'uncaughtException')
  })

  shutdownLog('render-start')
  instance = await render(
    <App onExit={() => shutdown(0, 'app:quit')} />,
    {
      exitOnCtrlC: false, // we handle Ctrl+C via the app:quit keybinding
      patchConsole: true,
    },
  )
  shutdownLog('render-done')

  await instance.waitUntilExit()
  shutdownLog('waitUntilExit-resolved')
  process.exit(0)
}

void main()



