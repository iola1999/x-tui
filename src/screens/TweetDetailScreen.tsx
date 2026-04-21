import React from 'react'
import { PlaceholderScreen } from '../components/PlaceholderScreen.js'

export function TweetDetailScreen({ id }: { id: string }): React.ReactNode {
  return (
    <PlaceholderScreen
      title={`Tweet ${id}`}
      body="Phase 5 — `twitter tweet <id> --json` + replies list."
    />
  )
}
