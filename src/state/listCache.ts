import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Tweet } from '../types/tweet.js'

/**
 * Stale-while-revalidate cache for any tweet list (feed, bookmarks, search,
 * user-posts). Entries stay mounted in module scope so tab switches and
 * drill-in/back round-trips don't throw away loaded data.
 *
 * Usage:
 *
 *   const { entry, loading, error, refresh } = useListData('feed', () => feed({ max: 30 }))
 *
 * `entry` is the cached result; updates arrive via useSyncExternalStore.
 * `refresh()` hard-refetches even if the cache is fresh.
 *
 * Focus index and scroll position are ALSO persisted on the entry so
 * navigating back to a list restores where the user was looking.
 */

export type ListEntry = {
  tweets: Tweet[]
  nextCursor?: string
  fetchedAt: number
  focusedIndex: number
  error: string | null
}

type Fetcher = () => Promise<{ tweets: Tweet[]; nextCursor?: string }>

const cache = new Map<string, ListEntry>()
const listeners = new Map<string, Set<() => void>>()
/** In-flight requests, keyed by cache key, to de-dupe parallel mounts. */
const inflight = new Map<string, Promise<void>>()
const lastKey = Symbol('lastKey')

const DEFAULT_TTL_MS = 60_000

function notify(key: string): void {
  const set = listeners.get(key)
  if (set) for (const l of set) l()
}

export function getListEntry(key: string): ListEntry | null {
  return cache.get(key) ?? null
}

export function setFocusedIndex(key: string, idx: number): void {
  const e = cache.get(key)
  if (!e) return
  if (e.focusedIndex === idx) return
  e.focusedIndex = idx
  notify(key)
}

export function invalidateList(key: string): void {
  cache.delete(key)
  notify(key)
}

/** Mutate a single tweet in a cached list (if present). Used by optimistic
 *  action handlers so the feed reflects the change without a refetch. */
export function mutateTweetInList(
  key: string,
  tweetId: string,
  updater: (t: Tweet) => Tweet,
): void {
  const e = cache.get(key)
  if (!e) return
  const idx = e.tweets.findIndex(t => t.id === tweetId)
  if (idx < 0) return
  const updated = updater(e.tweets[idx]!)
  const next = [...e.tweets]
  next[idx] = updated
  cache.set(key, { ...e, tweets: next })
  notify(key)
}

/** Mutate a tweet across EVERY list in cache — handy when the same tweet
 *  appears in feed + bookmarks + search results. */
export function mutateTweetEverywhere(tweetId: string, updater: (t: Tweet) => Tweet): void {
  for (const [k, e] of cache.entries()) {
    const idx = e.tweets.findIndex(t => t.id === tweetId)
    if (idx < 0) continue
    const next = [...e.tweets]
    next[idx] = updater(e.tweets[idx]!)
    cache.set(k, { ...e, tweets: next })
    notify(k)
  }
}

export function clearAllListCache(): void {
  cache.clear()
  for (const [k] of listeners) notify(k)
}

/** Test-only: inject an entry without going through the async hook path. */
export function __seedForTest(key: string, tweets: Tweet[]): void {
  cache.set(key, {
    tweets,
    fetchedAt: Date.now(),
    focusedIndex: 0,
    error: null,
  })
  notify(key)
}

/**
 * React hook. On mount:
 *   - If cache has a fresh entry (within `ttl`), don't fetch — just subscribe.
 *   - If cache has a stale entry, return it immediately AND kick a background
 *     refresh (stale-while-revalidate).
 *   - If no entry, fetch.
 *
 * `refresh()` forces a refetch regardless of freshness.
 */
export function useListData(
  key: string,
  fetcher: Fetcher,
  opts: { ttl?: number } = {},
): {
  entry: ListEntry | null
  loading: boolean
  error: string | null
  refresh: () => void
} {
  const ttl = opts.ttl ?? DEFAULT_TTL_MS

  const subscribe = useCallback(
    (listener: () => void) => {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(listener)
      return () => {
        set?.delete(listener)
      }
    },
    [key],
  )

  const entry = useSyncExternalStore(
    subscribe,
    () => cache.get(key) ?? null,
    () => cache.get(key) ?? null,
  )

  const fetchNow = useCallback(async () => {
    if (inflight.has(key)) return inflight.get(key)
    const p = (async () => {
      try {
        const res = await fetcher()
        const prev = cache.get(key)
        cache.set(key, {
          tweets: res.tweets,
          nextCursor: res.nextCursor,
          fetchedAt: Date.now(),
          focusedIndex: prev?.focusedIndex ?? 0,
          error: null,
        })
      } catch (e) {
        const prev = cache.get(key)
        cache.set(key, {
          tweets: prev?.tweets ?? [],
          nextCursor: prev?.nextCursor,
          fetchedAt: prev?.fetchedAt ?? 0,
          focusedIndex: prev?.focusedIndex ?? 0,
          error: (e as Error).message,
        })
      } finally {
        inflight.delete(key)
        notify(key)
      }
    })()
    inflight.set(key, p)
    return p
  }, [key, fetcher])

  useEffect(() => {
    const existing = cache.get(key)
    const fresh = existing && Date.now() - existing.fetchedAt < ttl && !existing.error
    if (!existing) {
      void fetchNow()
    } else if (!fresh) {
      // Stale — revalidate in background.
      void fetchNow()
    }
    // The (lastKey) anchor is intentional — we DO want to refetch when `key`
    // changes (different search query / profile handle), but not when the
    // fetcher identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const refresh = useCallback(() => {
    void fetchNow()
  }, [fetchNow])

  return {
    entry: entry ?? null,
    loading: !entry || inflight.has(key),
    error: entry?.error ?? null,
    refresh,
  }
}

// Silence TS unused warning for the symbol we might expose later.
void lastKey
