# x-tui roadmap

Where we are, what's done, what's still outstanding. Short-term items and backlog live here so the README can stay focused on "how do I use this".

Last reviewed: 2026-04-23.

## Status at a glance

| Area                                        | State         |
| ------------------------------------------- | ------------- |
| Workspace + Bun + @ant/ink vendoring         | ✅ done        |
| Fullscreen shell (alt-screen, tabs, status) | ✅ done        |
| Home timeline                                | ✅ done        |
| Tweet detail + replies                      | ✅ done        |
| User profile + user posts                   | ✅ done        |
| Bookmarks                                   | ✅ done        |
| Search (with filter chips)                  | ✅ done        |
| Compose (new / reply / quote)               | ✅ done        |
| Optimistic like / RT / bookmark / follow    | ✅ done        |
| Inline halfblock thumbnails                  | ✅ done        |
| Image viewer (halfblock fallback)           | ✅ done        |
| Auth gate + help overlay                    | ✅ done        |
| Stale-while-revalidate list cache           | ✅ done        |
| Context-aware status bar + Spinner          | ✅ done        |
| ErrorBoundary on the screen router          | ✅ done        |
| Clean Ctrl+C / q exit                       | ✅ done        |
| GitHub release workflow (manual trigger)    | ✅ done        |
| Pending-chord hint in status bar            | ✅ done        |
| OSC 8 hyperlink open handler                | ✅ done        |
| `Shift+Y` copy tweet text + link            | ✅ done        |
| Vendored `twitter-cli` maintenance boundary | ✅ done        |
| Native iTerm2 / Kitty viewer                 | ✅ done        |
| Sixel viewer                                  | ⬜ planned     |
| Sixel encoder                                | ⬜ planned     |
| Fuzzy picker for compose attachments        | ⬜ planned     |
| Feed pagination (cursor)                    | ⬜ planned     |
| Config persistence (`~/.config/x-tui`)      | ⬜ planned     |
| Configurable tweet-detail reply depth       | ⬜ planned     |
| Command mode (`:q`, `:refresh`, `:goto`)    | ⬜ planned     |
| Debug log file                              | ⬜ planned     |
| Double-click to like                        | ⬜ idea        |
| Viewport-aware spinner pause                | ⬜ idea        |
| Network-weather indicator                   | ⬜ idea        |

## Short-term — the next meaningful bump

Pick one, land it end-to-end, then move on.

### 1. Native thumbnails beyond halfblock

- `ImageViewerScreen` now writes native iTerm2 / Kitty graphics sequences for
  supported terminals and falls back to halfblock elsewhere.
- Inline `MediaThumbs` still use halfblock because protocol images bypass Ink's
  diff buffer and need their own redraw/cleanup rules to avoid stale paint.
- Next step is deciding whether protocol thumbnails are worth the extra
  complexity, or whether halfblock is good enough inline and native stays
  fullscreen-only.

### 2. Sixel encoder + detection

- Plan called out Sixel; `terminalCaps.ts` has an opt-in `X_TUI_ASSUME_SIXEL`
  but no active DA1 (`\x1b[c`) query yet.
- Encoder options:
  - `node-sixel` (pure JS).
  - `img2sixel` via `Bun.spawn` (depends on libsixel; simpler for first pass).
- Start with `img2sixel` so we don't add a native dep.

### 3. Compose image attachments via FuzzyPicker

- Ctrl+I currently prompts for a path. Replace with `FuzzyPicker` from
  `@anthropic/ink/theme`, seeded from `~/Downloads`, `~/Pictures`, `~/Desktop`.
- Cap 4 attachments (twitter-cli enforces; echo on the compose footer).

### 4. Cursor pagination in lists

- `services/twitterCli.ts` already returns `nextCursor`; `listCache` just
  throws it away.
- When the user hits the bottom of a list (`onReachEnd` fires), call the
  fetcher again with `{ cursor: entry.nextCursor }` and append.
- Show a tiny spinner row beneath the last card while the extra page loads.

### 5. Config persistence

- `~/.config/x-tui/config.json` — theme, default tab, image protocol override,
  tweet-detail reply page depth, keybinding overrides (`bindings.ts` already accepts overrides via
  `parseBindings`).
- Lazy-load on boot, write-back debounced when a setting changes.
- Settings screen under Profile tab (or `:theme` command once we add command
  mode).

## Repo maintenance

- `twitter-cli` now lives under `vendor/twitter-cli` as a clean vendored Python subproject.
- Keep Python-specific changes inside that directory and keep the Bun app talking to it only through the CLI / daemon protocol boundary.
- If we later want a standalone package again, the isolated directory can be split back out without restructuring the TypeScript app.

## Medium-term

### Command mode `:`

- `:q` / `:refresh` / `:goto @handle` / `:goto tweet/<id>` / `:theme`.
- Reuses the compose input widget with a `:` prefix and its own context
  binding set.

### Debug log

- `DEBUG_X_TUI=1` → tee everything the app considers non-fatal errors to
  `~/.cache/x-tui/debug.log`. Toasts still fire but the log lets us diagnose
  after-the-fact.

## Interaction / polish ideas (backlog)

These come from re-reading `claude-code` and from day-2 usage. Most are
small but none are blocking; list here so they stop rotting in comments.

- **Double-click to like** on `TweetCard`: Twitter convention. Requires
  wiring `onDoubleClick` on ink's mouse pipeline (there is a
  multi-click hook upstream — see `onMultiClick` in ink).
- **Viewport-aware spinner pause**: if the spinner row scrolls out of
  view, it should stop ticking (claude-code's `useAnimationFrame`
  already does this — we just need to attach the ref from its return
  value to the animated element so the viewport check runs).
- **Reduced-motion auto-detect**: respect `NO_COLOR` and
  `--no-animations`-style heuristics instead of only
  `X_TUI_REDUCED_MOTION=1`.
- **Orphan-TTY detection**: claude-code polls `process.stdout.writable`
  every 30s so a dead parent (SSH drop) isn't silently survived.
- **Telemetry boundary**: a single `logForDebugging` helper so every
  error path is captured uniformly (complements the debug log above).
- **Infinite-scroll inertia**: a tiny acceleration curve for wheel
  movement so flicks feel right (1 → 3 → 6 rows per notch as the user
  keeps scrolling).
- **Network-weather indicator**: if a twitter CLI call takes longer
  than 3s, add a `· slow network` badge to the status bar (à la
  claude-code's reconnecting/disconnected pill).

## Testing strategy

Keep tests targeted at invariants that would silently break if changed.
No coverage chasing. The current suite:

- `pickTweetDetail` — CLI response shape tolerance.
- `listCache` — focus index is immutable (regression guard for the j/k
  silent-failure bug).
- `store` — per-tab navigation stacks.
- `StatusBar` helpers — every `Screen` variant has a label + hints, and
  the pending-chord formatter pins a handful of modifier/Shift edge cases.
- `TweetText` — `@`/`#`/URL segmentation in English + CJK.
- `halfblock` / `iterm2-kitty` — ANSI structure is stable.
- `time` — relative time buckets.
- `terminalCaps` — protocol detection priority.
- `openUrl` — scheme allowlist for OSC 8 clicks (no `javascript:` etc.).

Add a new regression test each time a bug fix changes behavior (not
implementation); delete tests that only pin the current implementation.
