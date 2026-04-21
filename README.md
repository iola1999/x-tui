# x-tui

**Browse X (Twitter) from your terminal.** Full-screen alt-buffer UI, mouse & vim-like keys, inline image previews, read & write operations. Built on a forked [@anthropic/ink](./packages/@ant/ink) rendered via React 19 + Bun.

```
┌─────────────────────────────────────────────────────────────┐
│ 𝕏  ● 1 Feed   2 Search   3 Bookmarks   4 Profile            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ │ naiive ✓  @naiivememe                              3h     │
│ │ why didn't this guy become Apple CEO ?                   │
│ │                                                           │
│ │ [▀▀▀▀▀▀] [▀▀▀▀▀▀]                                         │
│ │ 💬 285  🔁 195  ♥ 5.8K  🔖 676  👁 1.0M                   │
│                                                             │
│   Dan Stark ✓  @itsdanstark                       6d        │
│   Within this very century… Aging will be cured. …          │
│   💬 33  🔁 35  ♥ 444  🔖 54  👁 541K                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Home timeline · 30 tweets · 12s ago                         │
│ j/k move · ⏎ open · / search · ? help · q quit              │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Full-screen alt-screen rendering** — like vim/htop, doesn't scroll your shell history. Clean exit restores the terminal.
- **Mouse first-class** — click tabs, tweets, `@handle`s, media thumbnails; wheel scroll moves focus through the list.
- **vim-like keys** — `j`/`k`/`gg`/`G`/`space` for movement; `l`/`t`/`b` for like/retweet/bookmark; `r`/`Shift+Q` for reply/quote; `/` for search; `?` for help.
- **Inline image previews** — halfblock (▀) thumbnails in the feed, full-size halfblock viewer on `i`. Auto-detects iTerm2 / Kitty / Sixel for future native-protocol rendering.
- **Stale-while-revalidate caching** — going back from a tweet detail doesn't refetch; per-list focus index is preserved.
- **Optimistic writes** — like/retweet/bookmark update locally on the tap, then reconcile; errors roll back with a toast.
- **Compose** — multiline editor for new tweets, replies, and quote tweets, with image attachments (up to 4).

## Requirements

- **Bun** ≥ 1.3 (`curl -fsSL https://bun.sh/install | bash`)
- **twitter** CLI by jackwener (v0.8+) — login flow runs separately:
  ```bash
  uv tool install twitter-cli  # or the repo's preferred install
  twitter auth login
  twitter status            # should print "Authenticated as @you"
  ```
- A terminal that supports SGR mouse tracking. iTerm2, Kitty, Ghostty, WezTerm, Alacritty, and Windows Terminal all work. Apple Terminal works too but without inline image protocols.

## Install

```bash
git clone https://github.com/iola1999/x-tui
cd x-tui
bun install
bun run build       # → dist/cli.js
./dist/cli.js       # run
```

Or run from source in dev mode:

```bash
bun run dev
```

## Usage

Launch with `bun run dev` (or `./dist/cli.js` after building). You'll be dropped into the home timeline.

### Keyboard reference

Global:

| Key            | Action                        |
| -------------- | ----------------------------- |
| `1` `2` `3` `4`| Feed / Search / Bookmarks / Profile |
| `?`            | Help overlay                  |
| `Ctrl+R`       | Refresh current screen        |
| `Ctrl+N`       | Compose new tweet             |
| `Esc`          | Back (pop current screen)     |
| `q` / `Ctrl+C` | Quit                          |

Inside any list (Feed / Bookmarks / Search / User posts / Replies):

| Key             | Action                           |
| --------------- | -------------------------------- |
| `j` / `k`       | Move focus down / up             |
| `↓` / `↑`       | Same                             |
| `Space` / `PgDn`| Page down (10 rows)              |
| `PgUp`          | Page up                          |
| `gg` / `G`      | Jump to top / bottom             |
| `Enter`         | Open tweet detail                |
| `i`             | Open media viewer                |
| `l` / `Shift+L` | Like / unlike                    |
| `t` / `Shift+T` | Retweet / unretweet              |
| `b` / `Shift+B` | Bookmark / unbookmark            |
| `r`             | Reply to focused tweet           |
| `Shift+Q`       | Quote focused tweet              |
| `f` / `Shift+F` | Follow / unfollow author         |
| `y`             | Copy tweet link (OSC 52)         |
| `/`             | Focus search input (on Search)   |

Compose (new / reply / quote):

| Key         | Action                        |
| ----------- | ----------------------------- |
| (typing)    | Append characters             |
| `Enter`     | Insert newline                |
| `Ctrl+Enter`| Send                          |
| `Ctrl+I`    | Add image path                |
| `Esc`       | Cancel                        |

Image viewer:

| Key           | Action              |
| ------------- | ------------------- |
| `h` / `←`     | Previous image      |
| `l` / `→`     | Next image          |
| `Esc` / `q`   | Close               |

Mouse:

- Click a tab in the top bar → switch tab
- Click a tweet → open detail
- Click an `@handle` in any text → open that user's profile
- Click a URL in a tweet → follow via OSC 8 (or system browser)
- Wheel scroll anywhere in a list → moves focus

## Environment variables

| Variable                        | Effect                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| `X_TUI_NO_FLICKER=0`            | Disable alt-screen (falls back to scrollback; mainly for debugging). |
| `X_TUI_DISABLE_MOUSE=1`         | Keep alt-screen but skip SGR mouse tracking.                         |
| `X_TUI_DISABLE_MOUSE_CLICKS=1`  | Keep wheel scroll but ignore clicks/drags.                           |
| `X_TUI_IMAGE_PROTOCOL=<p>`      | Force image protocol: `iterm2` / `kitty` / `sixel` / `halfblock` / `auto`. |
| `X_TUI_ASSUME_SIXEL=1`          | Hint that the current terminal supports sixel.                       |
| `X_TUI_CACHE_DIR=<path>`        | Override media cache dir (default `~/.cache/x-tui/media`).          |
| `X_TUI_TWITTER_CMD=<path>`      | Override the `twitter` executable name/path.                         |
| `X_TUI_REDUCED_MOTION=1`        | Replace the animated spinner with a static dot.                      |

## Architecture

```
x-tui/
├── packages/@ant/ink/         # Forked Ink (React 19 reconciler + Yoga)
└── src/
    ├── entrypoints/cli.tsx    # Bootstraps the render tree
    ├── App.tsx                # KeybindingSetup → Theme → Shell
    ├── components/
    │   ├── FullscreenShell    # AlternateScreen + TabBar + Content + StatusBar
    │   ├── TabBar / StatusBar / AuthGate
    │   ├── TweetCard / TweetList / TweetText / Author / MediaThumbs
    ├── screens/
    │   ├── FeedScreen, SearchScreen, BookmarksScreen, UserProfileScreen
    │   ├── TweetDetailScreen, ComposeScreen, ImageViewerScreen, HelpOverlay
    ├── services/
    │   ├── twitterCli.ts      # Bun.spawn wrappers for `twitter … --json`
    │   ├── tweetActions.ts    # Optimistic like/retweet/bookmark/follow handlers
    │   └── mediaCache.ts      # undici fetch + SHA1-keyed ~/.cache/x-tui/media
    ├── state/
    │   ├── store.ts           # Navigator stack + tabs + toasts + auth state
    │   └── listCache.ts       # Stale-while-revalidate tweet-list cache
    ├── utils/
    │   ├── fullscreen.ts      # X_TUI_NO_FLICKER / mouse switches
    │   ├── terminalCaps.ts    # Detect iTerm2 / Kitty / Sixel
    │   ├── imageEncoders/     # halfblock / iterm2 / kitty protocols
    │   └── time.ts            # Relative time + compact numbers
    ├── keybindings/bindings.ts # vim-like binding blocks + help text
    └── theme/twitterTheme.ts   # X brand blue, like pink, retweet green
```

### Rendering approach

x-tui copies the same "fullscreen" rendering path Claude Code uses when `CLAUDE_CODE_NO_FLICKER=1` is set:

- `AlternateScreen` wraps the root tree, entering DEC 1049 alt buffer and enabling SGR mouse tracking on mount, cleaning up on unmount (and via `signal-exit` for Ctrl+C).
- The shell is a flex column: fixed-height `TabBar` + fixed-height `StatusBar` sandwiching a `flexGrow: 1` screen router.
- Each list screen owns its own `ScrollBox` with viewport culling. Wheel events are forwarded explicitly via `useInput`.
- Inline images use halfblock glyphs (`▀` with fg=upper-pixel / bg=lower-pixel) wrapped in `<RawAnsi>` so Yoga sees them as a fixed `W × ceil(H/2)` leaf — fully compatible with Ink's screen-diff renderer.

## Development

```bash
bun run dev         # watch entrypoint
bun run typecheck   # tsc --noEmit (strict)
bun test            # unit tests (44 tests, 6 files)
bun run build       # production build → dist/
bun run lint        # biome check
```

Smoke scripts (skip the TUI, exercise the data layer):

```bash
bun run scripts/test-twitter.ts   # fetch feed + print 5 tweets
bun run scripts/test-image.ts     # fetch one photo + print halfblock output
```

### Running with reduced capabilities

```bash
X_TUI_DISABLE_MOUSE=1 bun run dev            # keep alt-screen, no mouse
X_TUI_NO_FLICKER=0 bun run dev               # scrollback mode (dev only)
X_TUI_IMAGE_PROTOCOL=halfblock bun run dev   # force halfblock even on iTerm2
X_TUI_REDUCED_MOTION=1 bun run dev           # static spinner dot
```

### Releasing

Releases are user-triggered. Two flavors — pick whichever you prefer:

```bash
# 1) Push a tag — the `release` workflow detects it automatically.
git tag v0.1.0 && git push origin v0.1.0

# 2) Or fire the workflow from the Actions tab (workflow_dispatch) and
#    supply the tag name. The workflow creates the tag on the current
#    commit, builds + tests, uploads source/dist tarballs as assets, and
#    publishes a GitHub release with auto-generated notes.
```

See `.github/workflows/release.yml` for the exact pipeline.

## Status

- Phase 0 — workspace scaffold ✓
- Phase 1 — `@anthropic/ink` vendoring ✓
- Phase 2 — App shell (alt-screen, tabs, status bar) ✓
- Phase 3 — data layer + home timeline ✓
- Phase 4 — image system (halfblock inline + viewer) ✓
- Phase 5 — tweet detail / user profile / bookmarks ✓
- Phase 6 — search with filter chips ✓
- Phase 7 — optimistic write actions + compose ✓
- Phase 8 — auth gate, help overlay, caching polish ✓

Planned but not yet wired: native iTerm2/Kitty/Sixel image rendering in the full-screen viewer (encoders are present in `src/utils/imageEncoders/`), fuzzy-picker for image attachments, persistent config.

## Acknowledgements

- `@anthropic/ink` — the fantastic forked Ink from [claude-code-best/claude-code](https://github.com/claude-code-best/claude-code).
- `twitter-cli` — headless X/Twitter client by [jackwener](https://github.com/jackwener/twitter-cli).

## License

MIT.
