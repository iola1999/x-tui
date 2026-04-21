/**
 * Shared action handlers for tweet lists and tweet details.
 * Optimistic updates + toast on error. Used by FeedScreen / TweetDetail /
 * UserPosts / Bookmarks / Search — centralized so the keybinding behavior
 * stays consistent everywhere.
 */
import type { Tweet } from '../types/tweet.js'
import {
  bookmark as apiBookmark,
  follow as apiFollow,
  like as apiLike,
  retweet as apiRetweet,
  unbookmark as apiUnbookmark,
  unfollow as apiUnfollow,
  unlike as apiUnlike,
  unretweet as apiUnretweet,
} from '../services/twitterCli.js'
import { push, showToast } from '../state/store.js'
import { tweetUrl } from '../types/tweet.js'

export type MutateTweet = (id: string, updater: (t: Tweet) => Tweet) => void

export function makeTweetActions(mutate: MutateTweet): {
  onLike: (t: Tweet) => void
  onRetweet: (t: Tweet) => void
  onBookmark: (t: Tweet) => void
  onFollow: (t: Tweet) => void
  onReply: (t: Tweet) => void
  onQuote: (t: Tweet) => void
  onCopyLink: (t: Tweet) => void
  onMedia: (t: Tweet) => void
  onProfile: (handle: string) => void
  onOpen: (t: Tweet) => void
} {
  async function withOptimistic<R>(
    id: string,
    optimistic: (t: Tweet) => Tweet,
    rollback: (t: Tweet) => Tweet,
    real: () => Promise<R>,
    messages: { ok: string; err: string },
  ): Promise<void> {
    mutate(id, optimistic)
    try {
      await real()
      showToast('success', messages.ok)
    } catch (e) {
      mutate(id, rollback)
      showToast('error', `${messages.err}: ${(e as Error).message}`)
    }
  }

  return {
    onOpen: (t: Tweet) => push({ kind: 'tweet', id: t.id }),
    onProfile: (handle: string) => push({ kind: 'profile', handle }),
    onReply: (t: Tweet) =>
      push({
        kind: 'compose',
        mode: { kind: 'reply', inReplyTo: { id: t.id, text: t.text, author: t.author.screenName } },
      }),
    onQuote: (t: Tweet) =>
      push({
        kind: 'compose',
        mode: { kind: 'quote', quoted: { id: t.id, text: t.text, author: t.author.screenName } },
      }),
    onMedia: (t: Tweet) => {
      const urls = (t.media ?? []).filter(m => m.type === 'photo').map(m => m.url)
      if (urls.length === 0) {
        showToast('info', 'No photos on this tweet.')
        return
      }
      push({ kind: 'imageViewer', urls, index: 0, tweetId: t.id })
    },
    onCopyLink: (t: Tweet) => {
      const url = tweetUrl(t)
      // OSC 52 clipboard — works in iTerm2, Kitty, WezTerm, Ghostty, tmux (if enabled).
      process.stdout.write(`\x1b]52;c;${Buffer.from(url).toString('base64')}\x07`)
      showToast('success', `Link copied: ${url}`)
    },
    onLike: (t: Tweet) => {
      const liked = t.metrics.likes > 0 ? undefined : undefined // placeholder — feed CLI doesn't expose "is-liked"
      // Without a reliable is-liked flag from the CLI we just call like() and bump count optimistically.
      void withOptimistic(
        t.id,
        prev => ({ ...prev, metrics: { ...prev.metrics, likes: prev.metrics.likes + 1 } }),
        prev => ({ ...prev, metrics: { ...prev.metrics, likes: Math.max(0, prev.metrics.likes - 1) } }),
        () => apiLike(t.id),
        { ok: 'Liked', err: 'Like failed' },
      )
      void liked
    },
    onRetweet: (t: Tweet) => {
      void withOptimistic(
        t.id,
        prev => ({ ...prev, metrics: { ...prev.metrics, retweets: prev.metrics.retweets + 1 } }),
        prev => ({ ...prev, metrics: { ...prev.metrics, retweets: Math.max(0, prev.metrics.retweets - 1) } }),
        () => apiRetweet(t.id),
        { ok: 'Retweeted', err: 'Retweet failed' },
      )
    },
    onBookmark: (t: Tweet) => {
      void withOptimistic(
        t.id,
        prev => ({ ...prev, metrics: { ...prev.metrics, bookmarks: prev.metrics.bookmarks + 1 } }),
        prev => ({
          ...prev,
          metrics: { ...prev.metrics, bookmarks: Math.max(0, prev.metrics.bookmarks - 1) },
        }),
        () => apiBookmark(t.id),
        { ok: 'Bookmarked', err: 'Bookmark failed' },
      )
    },
    onFollow: (t: Tweet) => {
      void (async () => {
        try {
          await apiFollow(t.author.screenName)
          showToast('success', `Following @${t.author.screenName}`)
        } catch (e) {
          showToast('error', `Follow failed: ${(e as Error).message}`)
        }
      })()
    },
  }
}

// Standalone unfollow/unlike/unretweet/unbookmark for Shift-prefixed keys.
export async function unlikeTweet(id: string, mutate: MutateTweet): Promise<void> {
  mutate(id, prev => ({ ...prev, metrics: { ...prev.metrics, likes: Math.max(0, prev.metrics.likes - 1) } }))
  try {
    await apiUnlike(id)
    showToast('success', 'Unliked')
  } catch (e) {
    mutate(id, prev => ({ ...prev, metrics: { ...prev.metrics, likes: prev.metrics.likes + 1 } }))
    showToast('error', `Unlike failed: ${(e as Error).message}`)
  }
}

export async function unretweetTweet(id: string, mutate: MutateTweet): Promise<void> {
  mutate(id, prev => ({ ...prev, metrics: { ...prev.metrics, retweets: Math.max(0, prev.metrics.retweets - 1) } }))
  try {
    await apiUnretweet(id)
    showToast('success', 'Unretweeted')
  } catch (e) {
    mutate(id, prev => ({ ...prev, metrics: { ...prev.metrics, retweets: prev.metrics.retweets + 1 } }))
    showToast('error', `Unretweet failed: ${(e as Error).message}`)
  }
}

export async function unbookmarkTweet(id: string, mutate: MutateTweet): Promise<void> {
  mutate(id, prev => ({
    ...prev,
    metrics: { ...prev.metrics, bookmarks: Math.max(0, prev.metrics.bookmarks - 1) },
  }))
  try {
    await apiUnbookmark(id)
    showToast('success', 'Unbookmarked')
  } catch (e) {
    mutate(id, prev => ({ ...prev, metrics: { ...prev.metrics, bookmarks: prev.metrics.bookmarks + 1 } }))
    showToast('error', `Unbookmark failed: ${(e as Error).message}`)
  }
}

export async function unfollowUser(handle: string): Promise<void> {
  try {
    await apiUnfollow(handle)
    showToast('success', `Unfollowed @${handle}`)
  } catch (e) {
    showToast('error', `Unfollow failed: ${(e as Error).message}`)
  }
}
