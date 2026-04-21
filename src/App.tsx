import React, { useCallback } from 'react'
import {
  KeybindingSetup,
  parseBindings,
  ThemeProvider,
  useKeybinding,
  type KeybindingsLoadResult,
} from '@anthropic/ink'
import { FullscreenShell } from './components/FullscreenShell.js'
import { DEFAULT_BINDINGS } from './keybindings/bindings.js'

function QuitHandler({ onQuit }: { onQuit: () => void }): React.ReactNode {
  useKeybinding('app:quit', onQuit, { context: 'Global' })
  return null
}

/**
 * Root component tree. Order matters:
 *   KeybindingSetup provides chord state to useKeybinding.
 *   ThemeProvider supplies theme colors; Box/Text look it up via context.
 *   FullscreenShell lives inside both.
 *
 * onExit is invoked by the shell's Ctrl+C / q handler, which triggers the
 * render unmount and restores the main screen buffer.
 */
export function App({ onExit }: { onExit: () => void }): React.ReactNode {
  const loadBindings = useCallback(
    (): KeybindingsLoadResult => ({
      bindings: parseBindings([...DEFAULT_BINDINGS]),
      warnings: [],
    }),
    [],
  )

  const subscribeToChanges = useCallback((_: (r: KeybindingsLoadResult) => void) => {
    // No live reload — user edits restart the app.
    return () => {}
  }, [])

  return (
    <KeybindingSetup loadBindings={loadBindings} subscribeToChanges={subscribeToChanges}>
      <ThemeProvider initialState="dark">
        <QuitHandler onQuit={onExit} />
        <FullscreenShell />
      </ThemeProvider>
    </KeybindingSetup>
  )
}
