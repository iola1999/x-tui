import React from 'react'
import { Box, Text, useKeybinding } from '@anthropic/ink'
import { pop, setActiveTab, useStore, type TabName } from '../state/store.js'
import { TW_BLUE, TW_DIM, TW_SUBTLE } from '../theme/twitterTheme.js'

const TABS: ReadonlyArray<{ id: TabName; label: string; hint: string }> = [
  { id: 'feed', label: 'Feed', hint: '1' },
  { id: 'search', label: 'Search', hint: '2' },
  { id: 'bookmarks', label: 'Bookmarks', hint: '3' },
  { id: 'profile', label: 'Profile', hint: '4' },
]

/**
 * Top bar. Each tab is clickable (ink-box onClick) and bound to 1/2/3/4.
 * Active tab gets a bold blue accent; inactive dim.
 */
export function TabBar(): React.ReactNode {
  const activeTab = useStore(s => s.activeTab)

  useKeybinding('app:tabFeed', () => setActiveTab('feed'), { context: 'Global' })
  useKeybinding('app:tabSearch', () => setActiveTab('search'), { context: 'Global' })
  useKeybinding('app:tabBookmarks', () => setActiveTab('bookmarks'), { context: 'Global' })
  useKeybinding('app:tabProfile', () => setActiveTab('profile'), { context: 'Global' })
  useKeybinding(
    'app:back',
    () => {
      const popped = pop()
      if (!popped) return false // let Global fall through to quit
    },
    { context: 'Global' },
  )

  return (
    <Box
      flexShrink={0}
      flexDirection="row"
      paddingX={1}
      paddingY={0}
      borderStyle="single"
      borderColor={TW_SUBTLE}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text color={TW_BLUE} bold>
        𝕏{' '}
      </Text>
      {TABS.map((tab, i) => {
        const active = tab.id === activeTab
        return (
          <Box key={tab.id} marginRight={2}>
            <Box onClick={() => setActiveTab(tab.id)}>
              <Text color={active ? TW_BLUE : TW_DIM} bold={active}>
                {active ? '● ' : '  '}
                {tab.hint} {tab.label}
              </Text>
            </Box>
            {i < TABS.length - 1 && <Text color={TW_SUBTLE}> </Text>}
          </Box>
        )
      })}
    </Box>
  )
}
