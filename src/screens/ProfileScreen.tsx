import React from 'react'
import { PlaceholderScreen } from '../components/PlaceholderScreen.js'

export function ProfileScreen({ handle }: { handle?: string }): React.ReactNode {
  return (
    <PlaceholderScreen
      title={handle ? `@${handle}` : 'Profile (whoami)'}
      body="Phase 5 — `twitter whoami` / `twitter user <handle>` + `twitter user-posts`."
    />
  )
}
