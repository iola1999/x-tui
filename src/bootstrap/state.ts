/**
 * Read session-global flags that gate how we boot.
 * Kept tiny and dependency-free — loaded from the CLI bootstrap path.
 */
export function getIsInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY)
}

export function getSessionId(): string {
  return _sessionId
}

const _sessionId = `x-tui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
