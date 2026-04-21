import React, { useEffect, useRef, useState } from 'react'
import { Box, RawAnsi, Text } from '@anthropic/ink'
import type { Media } from '../types/tweet.js'
import { getMediaBuffer } from '../services/mediaCache.js'
import { renderHalfblock } from '../utils/imageEncoders/halfblock.js'
import { TW_DIM } from '../theme/twitterTheme.js'

type Encoded = { lines: string[]; width: number; height: number } | null

const MAX_THUMBS = 4

/**
 * Inline halfblock thumbnails for a tweet's media. Always uses halfblock (no
 * protocol images) because iTerm2/Kitty/Sixel bypass Ink's diff buffer and
 * would get painted over on the next render.
 *
 * Sizing: each thumb is ~16 cols wide × ~8 cell rows tall. Videos and gifs
 * render as a compact text tile.
 */
export function MediaThumbs({ media }: { media: Media[] }): React.ReactNode {
  const photos = media.filter(m => m.type === 'photo').slice(0, MAX_THUMBS)
  const nonPhotos = media.filter(m => m.type !== 'photo')
  const [encoded, setEncoded] = useState<Encoded[]>(() => photos.map(() => null))
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    photos.forEach(async (p, i) => {
      try {
        const buf = await getMediaBuffer(p.url)
        if (cancelled.current) return
        const enc = await renderHalfblock(new Uint8Array(buf), { cols: 16, maxRows: 8 })
        if (cancelled.current) return
        setEncoded(prev => {
          const next = [...prev]
          next[i] = enc
          return next
        })
      } catch {
        // Swallow thumbnail errors — the card still renders without the tile.
      }
    })
    return () => {
      cancelled.current = true
    }
    // Re-run whenever the set of URLs changes; stringify to compare content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.map(p => p.url).join('|')])

  if (photos.length === 0 && nonPhotos.length === 0) return null

  return (
    <Box flexDirection="row" gap={1} marginTop={1}>
      {photos.map((p, i) => {
        const enc = encoded[i]
        if (!enc) {
          return (
            <Box key={p.url} width={16} height={8} flexShrink={0}>
              <Text color={TW_DIM}>[loading…]</Text>
            </Box>
          )
        }
        return (
          <Box key={p.url} flexShrink={0}>
            <RawAnsi lines={enc.lines} width={enc.width} />
          </Box>
        )
      })}
      {nonPhotos.map(m => (
        <Box
          key={m.url}
          flexShrink={0}
          width={16}
          height={8}
          borderStyle="single"
          borderColor={TW_DIM}
          justifyContent="center"
          alignItems="center"
        >
          <Text color={TW_DIM}>{m.type === 'video' ? '🎥 video' : `📎 ${m.type}`}</Text>
        </Box>
      ))}
    </Box>
  )
}
