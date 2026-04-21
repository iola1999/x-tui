import React from 'react'
import { AlternateScreen, Box, useKeybinding } from '@anthropic/ink'
import { AuthGate } from './AuthGate.js'
import { ErrorBoundary } from './ErrorBoundary.js'
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
 * Root layout used inside AlternateScreen. Column:
 *   1. TabBar (top, fixed)
 *   2. Active screen (grows; each screen owns its own ScrollBox if it needs one)
 *   3. StatusBar (bottom, fixed)
 */
export function FullscreenShell(): React.ReactNode {
  useKeybinding('app:help', () => push({ kind: 'help' }), { context: 'Global' })
  useKeybinding('app:compose', () => push({ kind: 'compose', mode: { kind: 'new' } }), {
    context: 'Global',
  })

  return (
    <AlternateScreen mouseTracking={isMouseTrackingEnabled()}>
      <Box flexDirection="column" width="100%" height="100%">
        <TabBar />
        <Box flexGrow={1} flexDirection="column" overflow="hidden">
          <AuthGate>
            <ErrorBoundary>
              <ScreenRouter />
            </ErrorBoundary>
          </AuthGate>
        </Box>
        <StatusBar />
      </Box>
    </AlternateScreen>
  )
}
