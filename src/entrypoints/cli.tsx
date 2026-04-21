#!/usr/bin/env bun
import React from 'react'
import { wrappedRender as render } from '@anthropic/ink'
import { onExit } from 'signal-exit'
import { App } from '../App.js'
import { isFullscreenActive } from '../utils/fullscreen.js'

/**
 * Why `process.exit(0)` after `waitUntilExit()`:
 *
 * Ink's unmount path writes EXIT_ALT_SCREEN, DISABLE_MOUSE_TRACKING,
 * SHOW_CURSOR etc. synchronously via `writeSync(1, …)`, so the terminal is
 * visually restored. But the Bun event loop can stay alive on open references
 * the user never sees: stdin raw-mode ref, undici connect pools,
 * `setTimeout(kill, timeout)` timers inside outstanding `runTwitter` calls,
 * signal-exit listeners, etc. Without an explicit exit we come back to the
 * shell but the `bun` process never returns, which is exactly what the user
 * reported as "stuck on the bun screen after pressing q / Ctrl+C".
 *
 * We keep the SIGINT / SIGTERM / SIGHUP handlers as a belt-and-suspenders:
 * if something inside the React tree swallows the quit keybinding, an OS
 * signal still takes us down cleanly (ink's internal `onExit(this.unmount)`
 * will run during the `process.exit` pass to flush terminal resets).
 *
 * signal-exit pin: short-lived signal-exit v4 subscribers (e.g. any Ink
 * instance that unmounts) can trigger v4's `unload()` when their unsubscribe
 * runs. Under Bun, `process.removeListener(sig, fn)` resets the kernel
 * sigaction — so SIGTERM would fall through to default (terminate) and our
 * handlers would never run. We register a no-op `onExit` here and never
 * unsubscribe, keeping v4's emitter count > 0 and its handlers pinned.
 * (Same trick and same reasoning as claude-code's gracefulShutdown.)
 */
onExit(() => {})

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
  const shutdown = (code: number): void => {
    try {
      instance?.unmount()
    } catch {
      // best-effort; ink's signal-exit hook will still run
    }
    process.exit(code)
  }

  process.once('SIGTERM', () => shutdown(143))
  process.once('SIGHUP', () => shutdown(129))
  // SIGINT: ink's own handler covers the in-app path, but if the ink key
  // pipeline is stalled (e.g. mid-render), the OS signal still wins.
  process.once('SIGINT', () => shutdown(130))
  process.on('uncaughtException', err => {
    // eslint-disable-next-line no-console
    console.error('\nx-tui crashed:', err)
    shutdown(1)
  })

  instance = await render(<App onExit={() => instance?.unmount()} />, {
    exitOnCtrlC: false, // we handle Ctrl+C via the app:quit keybinding
    patchConsole: true,
  })

  await instance.waitUntilExit()
  // waitUntilExit resolves after ink's synchronous terminal-mode resets;
  // force-exit so lingering event-loop refs (undici pools, raw stdin) don't
  // strand us at the post-render bun prompt.
  process.exit(0)
}

void main()


