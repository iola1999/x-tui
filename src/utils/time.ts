/**
 * Human-friendly "3h ago" formatting. Locale-neutral by design — the twitter
 * CLI already provides `createdAtLocal` for absolute display, so we only need
 * relative here.
 */
export function formatRelative(iso: string | undefined, now = Date.now()): string {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const secs = Math.max(0, Math.floor((now - ts) / 1000))
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  const years = Math.floor(days / 365)
  return `${years}y`
}

/**
 * Compact number suffix: 1234 → 1.2K, 12345 → 12K, 1234567 → 1.2M.
 */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1)}K`
  if (n < 1_000_000) return `${Math.floor(n / 1000)}K`
  if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${Math.floor(n / 1_000_000)}M`
}
