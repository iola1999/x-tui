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

Tweet detail currently loads in two stages:

- the main tweet first
- then only the first page of replies

This reply-depth limit is intentional for latency. Making tweet-detail reply pages configurable is planned for a future settings/config release.

## Requirements

- **Bun** ≥ 1.3 (`curl -fsSL https://bun.sh/install | bash`)
- **Compatible `twitter` CLI** with daemon + `--pages` support.
  During source development, the maintained copy lives in [`vendor/twitter-cli`](./vendor/twitter-cli).
  For packaged/global `x-tui` installs, keep a compatible `twitter` binary on `PATH` or set `X_TUI_TWITTER_CMD`.
- Login flow runs separately:
  ```bash
  # repo development
  cd vendor/twitter-cli
  uv sync
  ./.venv/bin/twitter auth login
  ./.venv/bin/twitter status  # should print "Authenticated as @you"

  # packaged/global x-tui installs
  uv tool install twitter-cli
  twitter auth login
  twitter status              # should print "Authenticated as @you"
  ```
- A terminal that supports SGR mouse tracking. iTerm2, Kitty, Ghostty, WezTerm, Alacritty, and Windows Terminal all work. Apple Terminal works too but without inline image protocols.

## Install

```bash
# Globally via npm — recommended
npm install -g x-tui
x-tui

# One-off via npx
npx x-tui
```

Or run from source:

```bash
git clone https://github.com/iola1999/x-tui
cd x-tui
bun install
cd vendor/twitter-cli && uv sync && cd ../..
bun run dev
```

When `vendor/twitter-cli/.venv/bin/twitter` exists, `x-tui` will prefer it automatically.

## Keyboard reference

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
| `X_TUI_TWITTER_TRANSPORT=spawn` | Disable the resident `twitter daemon` process and force one-shot CLI calls. |
| `X_TUI_REDUCED_MOTION=1`        | Replace the animated spinner with a static dot.                      |

## Development

```bash
bun run dev         # watch entrypoint
bun run typecheck   # tsc --noEmit (strict)
bun test            # unit tests
bun run build       # production build → dist/
bun run lint        # biome check
```

`twitter-cli` is maintained in-tree under [`vendor/twitter-cli`](./vendor/twitter-cli). Keep Python changes isolated there and communicate with it only through the executable / daemon boundary. See [`docs/vendor-twitter-cli.md`](./docs/vendor-twitter-cli.md) for setup, verification, and future standalone-package notes.

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the status of each feature and what's planned next.

### Releasing

Releases are user-triggered. Push a tag (`git tag v0.1.0 && git push origin v0.1.0`) or fire the `release` workflow from the Actions tab with a tag name — either path builds, tests, publishes to NPM (requires `NPM_TOKEN` secret), and attaches source/dist tarballs to a GitHub release. See [`.github/workflows/release.yml`](./.github/workflows/release.yml) for details.

## Acknowledgements

- `@anthropic/ink` — the fantastic forked Ink from [claude-code-best/claude-code](https://github.com/claude-code-best/claude-code).
- `twitter-cli` — headless X/Twitter client by [jackwener](https://github.com/jackwener/twitter-cli).

## License

MIT.
