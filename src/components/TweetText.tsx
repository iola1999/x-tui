import React, { useMemo } from 'react'
import { Box, Link, Text } from '@anthropic/ink'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; handle: string }
  | { kind: 'hashtag'; tag: string }
  | { kind: 'url'; url: string }

/**
 * Lightweight linkifier that splits tweet text into mention / hashtag / url
 * spans. Deliberately regex-only — we don't need perfect RFC parsing, and
 * whatever the tweet CLI didn't pre-expand will stay as an `https://t.co/...`
 * short-link rendered via <Link>.
 */
function tokenize(text: string): Segment[] {
  const segments: Segment[] = []
  const re = /(@([A-Za-z0-9_]{1,30}))|(#([^\s#@]{1,60}))|((?:https?:\/\/)[^\s]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', value: text.slice(last, m.index) })
    if (m[2]) {
      segments.push({ kind: 'mention', handle: m[2] })
    } else if (m[4]) {
      segments.push({ kind: 'hashtag', tag: m[4] })
    } else if (m[5]) {
      segments.push({ kind: 'url', url: m[5] })
    }
    last = re.lastIndex
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}

export function TweetText({
  text,
  onMention,
}: {
  text: string
  onMention?: (handle: string) => void
}): React.ReactNode {
  const segments = useMemo(() => tokenize(text), [text])
  return (
    <Box flexDirection="row" flexWrap="wrap">
      {segments.map((s, i) => {
        if (s.kind === 'text') {
          return (
            <Text key={i} wrap="wrap">
              {s.value}
            </Text>
          )
        }
        if (s.kind === 'mention') {
          const open = onMention ? () => onMention(s.handle) : undefined
          return (
            <Box key={i} onClick={open}>
              <Text color={TW_BLUE}>{`@${s.handle}`}</Text>
            </Box>
          )
        }
        if (s.kind === 'hashtag') {
          return (
            <Text key={i} color={TW_BLUE}>{`#${s.tag}`}</Text>
          )
        }
        // url — use Link so iTerm2/Ghostty can open via Cmd+click natively.
        return (
          <Link key={i} url={s.url}>
            <Text color={TW_BLUE} underline>
              {s.url}
            </Text>
          </Link>
        )
      })}
    </Box>
  )
}
