import React from 'react'
import { PlaceholderScreen } from '../components/PlaceholderScreen.js'

export function ImageViewerScreen({
  urls,
  index,
}: {
  urls: string[]
  index: number
  tweetId?: string
}): React.ReactNode {
  return (
    <PlaceholderScreen
      title={`Image ${index + 1} / ${urls.length}`}
      body={`Phase 4 will render ${urls[index]} via iTerm2 / Kitty / Sixel / halfblock.`}
    />
  )
}
