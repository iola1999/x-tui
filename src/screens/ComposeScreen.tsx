import React from 'react'
import { PlaceholderScreen } from '../components/PlaceholderScreen.js'
import type { ComposeMode } from '../state/store.js'

export function ComposeScreen({ mode }: { mode: ComposeMode }): React.ReactNode {
  const title =
    mode.kind === 'reply'
      ? `Reply to @${mode.inReplyTo.author}`
      : mode.kind === 'quote'
        ? `Quote @${mode.quoted.author}`
        : 'Compose'
  return (
    <PlaceholderScreen title={title} body="Phase 7 — multiline editor + image attach." />
  )
}
