import React from 'react'
import { PlaceholderScreen } from '../components/PlaceholderScreen.js'

export function FeedScreen(): React.ReactNode {
  return (
    <PlaceholderScreen
      title="Home timeline"
      body="Phase 3 will wire `twitter feed --json` here. For now this is a stub — press Esc to close, 2/3/4 to switch tabs, ? for help."
    />
  )
}
