/**
 * Types mirroring `twitter <command> --json` output from twitter-cli 0.8.x.
 * Every field is annotated with its source `--json` key. Unknown/absent keys
 * are typed as optional so we can survive schema bumps.
 */

export type Author = {
  id: string
  name: string
  screenName: string
  profileImageUrl?: string
  verified?: boolean
}

export type Metrics = {
  likes: number
  retweets: number
  replies: number
  quotes: number
  views: number
  bookmarks: number
}

export type Media = {
  type: 'photo' | 'video' | 'animated_gif' | string
  url: string
  width?: number
  height?: number
}

export type Tweet = {
  id: string
  text: string
  author: Author
  metrics: Metrics
  createdAt?: string
  createdAtLocal?: string
  createdAtISO?: string
  media?: Media[]
  urls?: Array<{ url: string; expandedUrl?: string; displayUrl?: string } | string>
  isRetweet?: boolean
  retweetedBy?: Author | null
  lang?: string
  score?: number | null
  /**
   * Present on tweet-detail / reply fetches — the conversation parent's id,
   * if any. twitter-cli doesn't always populate this; treat as best-effort.
   */
  inReplyToId?: string
}

export type FeedResponse = {
  ok: boolean
  schema_version?: string
  data: Tweet[]
  /** twitter-cli returns the next-page cursor either at the top level or as
   *  `next_cursor` / `nextCursor` depending on the command. We accept both. */
  cursor?: string
  nextCursor?: string
  next_cursor?: string
  pagination?: { nextCursor?: string }
  error?: string
}

export type UserResponse = {
  ok: boolean
  data: {
    user: Author & {
      bio?: string
      location?: string
      url?: string
      followers?: number
      following?: number
      tweets?: number
      likes?: number
      createdAt?: string
    }
  }
  error?: string
}

/**
 * `twitter tweet <id> --json` returns `data` as an array where index 0 is the
 * requested tweet and the remaining entries are its replies (in thread order).
 * We normalize to `{ tweet, replies }` in the service layer.
 */
export type TweetDetailResponse = {
  ok: boolean
  data: Tweet[]
  error?: string
}

export type WriteResponse = {
  ok: boolean
  data?: Tweet | { id?: string }
  error?: string
}

/** The primitive tweet link URL, used for `y` (copy link). */
export function tweetUrl(t: Tweet): string {
  return `https://x.com/${t.author.screenName}/status/${t.id}`
}
