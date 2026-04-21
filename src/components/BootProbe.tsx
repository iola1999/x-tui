import { useEffect } from 'react'
import { useKeybinding } from '@anthropic/ink'
import { TwitterCliError, whoami } from '../services/twitterCli.js'
import { setBootError } from '../state/store.js'

/**
 * Runs `twitter whoami` at boot (and whenever the user hits Ctrl+R while the
 * BootGate is showing). On success, clears any existing bootError so the
 * screens unblock. On failure, the TwitterCliError's pre-classified `kind`
 * drives which onboarding panel BootGate renders (cliMissing / notLoggedIn /
 * other).
 *
 * This lives above the screen router — it doesn't render anything itself —
 * so it probes even if the user is staring at Bookmarks or Profile first.
 */
async function probe(): Promise<void> {
  try {
    await whoami()
    setBootError(null)
  } catch (e) {
    if (e instanceof TwitterCliError) {
      setBootError({
        kind: e.kind,
        message: e.stderr || e.message,
      })
    } else {
      setBootError({
        kind: 'other',
        message: (e as Error).message ?? String(e),
      })
    }
  }
}

export function BootProbe(): null {
  useEffect(() => {
    void probe()
  }, [])

  // Ctrl+R also triggers the per-screen refresh; both paths firing is fine
  // since probe() is a single whoami round-trip and the set-state is
  // idempotent when there's no bootError change.
  useKeybinding('app:refresh', () => void probe(), { context: 'Global' })

  return null
}
