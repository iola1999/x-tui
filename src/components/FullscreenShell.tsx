import React from 'react'
import { AlternateScreen, Box, ScrollBox, useKeybinding } from '@anthropic/ink'
import { TabBar } from './TabBar.js'
import { StatusBar } from './StatusBar.js'
import { FeedScreen } from '../screens/FeedScreen.js'
import { SearchScreen } from '../screens/SearchScreen.js'
import { BookmarksScreen } from '../screens/BookmarksScreen.js'
import { ProfileScreen } from '../screens/ProfileScreen.js'
import { TweetDetailScreen } from '../screens/TweetDetailScreen.js'
import { ComposeScreen } from '../screens/ComposeScreen.js'
import { ImageViewerScreen } from '../screens/ImageViewerScreen.js'
import { HelpOverlay } from '../screens/HelpOverlay.js'
import { currentScreen, push, useStore } from '../state/store.js'
import { isMouseTrackingEnabled } from '../utils/fullscreen.js'

function ScreenRouter(): React.ReactNode {
  const screen = useStore(currentScreen)
  switch (screen.kind) {
    case 'feed':
      return <FeedScreen />
    case 'search':
      return <SearchScreen />
    case 'bookmarks':
      return <BookmarksScreen />
    case 'profile':
      return <ProfileScreen handle={screen.handle} />
    case 'tweet':
      return <TweetDetailScreen id={screen.id} />
    case 'compose':
      return <ComposeScreen mode={screen.mode} />
    case 'imageViewer':
      return <ImageViewerScreen urls={screen.urls} index={screen.index} tweetId={screen.tweetId} />
    case 'help':
      return <HelpOverlay />
  }
}

/**
 * Root layout used inside AlternateScreen. A flex column with:
 *   1. TabBar (top, fixed)
 *   2. ScrollBox (grows, holds the active screen)
 *   3. StatusBar (bottom, fixed)
 *
 * Mirrors claude-code's FullscreenLayout structure but omits the chat-only
 * bits (sticky prompt header, unseen-messages pill, bottom-float).
 */
export function FullscreenShell(): React.ReactNode {
  useKeybinding('app:help', () => push({ kind: 'help' }), { context: 'Global' })

  return (
    <AlternateScreen mouseTracking={isMouseTrackingEnabled()}>
      <Box flexDirection="column" width="100%" height="100%">
        <TabBar />
        <ScrollBox flexGrow={1} flexDirection="column" stickyScroll={false}>
          <ScreenRouter />
        </ScrollBox>
        <StatusBar />
      </Box>
    </AlternateScreen>
  )
}
