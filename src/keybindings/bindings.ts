import type { KeybindingBlock } from '@anthropic/ink'

/**
 * x-tui's default keybindings. vim-like on top, mouse + arrow keys work in
 * parallel for non-vim users.
 *
 * Contexts map directly to screens/modes. `useRegisterKeybindingContext(name)`
 * at the top of each screen scopes its handlers.
 */
export const DEFAULT_BINDINGS: KeybindingBlock[] = [
  {
    context: 'Global',
    bindings: {
      '?': 'app:help',
      q: 'app:quit',
      'ctrl+c': 'app:quit',
      'ctrl+r': 'app:refresh',
      'ctrl+n': 'app:compose',
      '1': 'app:tabFeed',
      '2': 'app:tabSearch',
      '3': 'app:tabBookmarks',
      '4': 'app:tabProfile',
      escape: 'app:back',
    },
  },
  {
    context: 'List',
    bindings: {
      j: 'list:down',
      downarrow: 'list:down',
      k: 'list:up',
      uparrow: 'list:up',
      'g g': 'list:top',
      G: 'list:bottom',
      space: 'list:pageDown',
      pagedown: 'list:pageDown',
      pageup: 'list:pageUp',
      return: 'list:open',
      i: 'list:media',
      l: 'list:like',
      'shift+l': 'list:unlike',
      t: 'list:retweet',
      'shift+t': 'list:unretweet',
      b: 'list:bookmark',
      'shift+b': 'list:unbookmark',
      r: 'list:reply',
      'shift+q': 'list:quote',
      f: 'list:follow',
      'shift+f': 'list:unfollow',
      y: 'list:copyLink',
      '/': 'list:search',
    },
  },
  {
    context: 'Compose',
    bindings: {
      'ctrl+return': 'compose:submit',
      'ctrl+i': 'compose:addImage',
      escape: 'compose:cancel',
    },
  },
  {
    context: 'ImageViewer',
    bindings: {
      h: 'image:prev',
      leftarrow: 'image:prev',
      l: 'image:next',
      rightarrow: 'image:next',
      escape: 'image:close',
      q: 'image:close',
    },
  },
]

/**
 * Human-readable binding labels grouped by context — used by the Help overlay.
 */
export const BINDING_HELP: ReadonlyArray<{
  section: string
  rows: ReadonlyArray<{ keys: string; action: string }>
}> = [
  {
    section: 'Global',
    rows: [
      { keys: '1 / 2 / 3 / 4', action: 'Switch tabs (Feed / Search / Bookmarks / Profile)' },
      { keys: '?', action: 'This help' },
      { keys: 'Ctrl+R', action: 'Refresh current screen' },
      { keys: 'Ctrl+N', action: 'New tweet (compose)' },
      { keys: 'Esc', action: 'Back (or quit when at root)' },
      { keys: 'q / Ctrl+C', action: 'Quit' },
    ],
  },
  {
    section: 'List',
    rows: [
      { keys: 'j / k · ↓ / ↑', action: 'Move focus' },
      { keys: 'gg / G', action: 'Jump to top / bottom' },
      { keys: 'Space / PgDn · PgUp', action: 'Page' },
      { keys: 'Enter', action: 'Open tweet' },
      { keys: 'i', action: 'Open media viewer' },
      { keys: 'l / Shift+L', action: 'Like / unlike' },
      { keys: 't / Shift+T', action: 'Retweet / unretweet' },
      { keys: 'b / Shift+B', action: 'Bookmark / unbookmark' },
      { keys: 'r', action: 'Reply' },
      { keys: 'Shift+Q', action: 'Quote tweet' },
      { keys: 'f / Shift+F', action: 'Follow / unfollow author' },
      { keys: 'y', action: 'Copy tweet link' },
      { keys: '/', action: 'Search' },
    ],
  },
  {
    section: 'Compose',
    rows: [
      { keys: 'Ctrl+Enter', action: 'Send' },
      { keys: 'Ctrl+I', action: 'Add image' },
      { keys: 'Esc', action: 'Cancel' },
    ],
  },
  {
    section: 'Image viewer',
    rows: [
      { keys: 'h / ← · l / →', action: 'Previous / next image' },
      { keys: 'Esc / q', action: 'Close' },
    ],
  },
]
