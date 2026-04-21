import React from 'react'
import { Box, Text, useKeybindingContext } from '@anthropic/ink'
import { currentScreen, type Screen, useStore } from '../state/store.js'
import { TW_BLUE, TW_DIM, TW_SUBTLE } from '../theme/twitterTheme.js'

export function screenLabelFor(s: Screen): string {
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

/**
 * Per-screen hint strings so the status bar reflects the keybinding context
 * that's actually active. Keep each line short enough not to push past 80
 * columns; the tab label + toast share the left half.
 */
export function screenHintsFor(s: Screen): string {
  switch (s.kind) {
    case 'compose':
      return '⏎ send · Ctrl+I image · Esc cancel'
    case 'imageViewer':
      return 'h/← prev · l/→ next · Esc close'
    case 'help':
      return 'Esc close'
    case 'tweet':
      return 'j/k move · ⏎ open · r reply · Esc back'
    default:
      return 'j/k move · ⏎ open · / search · ? help · q quit'
  }
}

function toastIcon(kind: 'info' | 'success' | 'error'): string {
  return kind === 'success' ? '✓' : kind === 'error' ? '✗' : 'ℹ'
}

type Keystroke = {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  super: boolean
}

/** Render a chord-in-progress like `g`, `Ctrl+X`, or `Space` — so users who
 *  tapped the first key of a `gg`/`gi` chord know we saw them and are
 *  waiting for the next key. The trailing `…` makes "waiting" visible. */
export function formatPendingChord(chord: Keystroke[] | null): string | null {
  if (!chord || chord.length === 0) return null
  return (
    chord
      .map(k => {
        const mods: string[] = []
        if (k.ctrl) mods.push('Ctrl')
        if (k.alt) mods.push('Alt')
        if (k.meta) mods.push('Meta')
        if (k.shift && k.key.length > 1) mods.push('Shift')
        const label = k.key === ' ' ? 'Space' : k.key
        return mods.length ? `${mods.join('+')}+${label}` : label
      })
      .join(' ') + '…'
  )
}

export function StatusBar(): React.ReactNode {
  const toast = useStore(s => s.toasts.at(-1) ?? null)
  // Re-render on screen changes so hints follow the top of the stack.
  useStore(s => s.stacks[s.activeTab].length)
  useStore(s => s.activeTab)

  const { pendingChord } = useKeybindingContext()
  const chordHint = formatPendingChord(pendingChord)

  const screen = currentScreen()
  const label = screenLabelFor(screen)
  const hints = screenHintsFor(screen)

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
            · {toastIcon(toast.kind)} {toast.text}
          </Text>
        )}
      </Box>
      <Box flexDirection="row" gap={1}>
        {chordHint && <Text color={TW_BLUE}>{chordHint}</Text>}
        <Text color={TW_DIM}>{hints}</Text>
      </Box>
    </Box>
  )
}
