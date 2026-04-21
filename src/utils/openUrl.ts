/**
 * Open a URL in the user's default browser. Fires and forgets — caller
 * doesn't block on the child process.
 *
 * Used by:
 *   - the global OSC 8 hyperlink handler (App.tsx) so clicks on URLs in
 *     tweet text / replies open them system-side, since fullscreen mode
 *     captures mouse events before the terminal can act on OSC 8 natively.
 *   - any future "open external link" action.
 */
const OPENER: Record<string, { cmd: string; wrap?: (url: string) => string[] }> = {
  darwin: { cmd: 'open' },
  linux: { cmd: 'xdg-open' },
  // On Windows `start` is a cmd builtin, so we go through cmd /c. The empty
  // "" is the window title — required when the URL would otherwise be
  // interpreted as the title.
  win32: { cmd: 'cmd', wrap: url => ['/c', 'start', '""', url] },
}

/** Gate on scheme so a `javascript:` OSC 8 link can't ever reach `open`. */
export function isOpenable(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export function openUrl(url: string): void {
  if (!isOpenable(url)) return
  const entry = OPENER[process.platform as keyof typeof OPENER] ?? OPENER.linux!
  try {
    Bun.spawn({
      cmd: [entry.cmd, ...(entry.wrap ? entry.wrap(url) : [url])],
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
    })
  } catch {
    // Best-effort — a missing `open` binary shouldn't crash the UI.
  }
}
