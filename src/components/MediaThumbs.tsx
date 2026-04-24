import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, RawAnsi, Text } from '@anthropic/ink'
import sharp from 'sharp'
import type { Media } from '../types/tweet.js'
import { getMediaBuffer } from '../services/mediaCache.js'
import { renderHalfblock } from '../utils/imageEncoders/halfblock.js'
import { getTerminalCaps } from '../utils/terminalCaps.js'
import { NativeImageBox } from './NativeImageBox.js'
import { TW_DIM } from '../theme/twitterTheme.js'
import {
  buildNativeImageSequence,
  fitImageCellsIntoBox,
  resolveNativeImageProtocol,
  resolveImageViewerMode,
} from '../screens/imageViewerNative.js'

type Encoded =
  | { kind: 'ansi'; lines: string[]; width: number; height: number }
  | {
      kind: 'native'
      protocol: NonNullable<ReturnType<typeof resolveNativeImageProtocol>>
      sequence: string
      widthCells: number
      heightCells: number
    }
  | null

const MAX_THUMBS = 4
const THUMB_MAX_WIDTH = 16
const THUMB_MAX_HEIGHT = 8

/**
 * Inline thumbnails for a tweet's media.
 *
 * Native terminal image protocols are preferred when supported. The layout
 * footprint stays fixed at ~16 cols × 8 rows so cards do not reflow between
 * terminals; unsupported terminals fall back to halfblock ANSI tiles.
 */
export function MediaThumbs({
  media,
  onOpen,
}: {
  media: Media[]
  onOpen?: (photoIndex: number) => void
}): React.ReactNode {
  const photos = useMemo(
    () => media.filter(m => m.type === 'photo').slice(0, MAX_THUMBS),
    [media],
  )
  const nonPhotos = useMemo(() => media.filter(m => m.type !== 'photo'), [media])
  const [encoded, setEncoded] = useState<Encoded[]>(() => photos.map(() => null))
  const cancelled = useRef(false)
  const protocol = getTerminalCaps().protocol
  const nativeProtocol = resolveNativeImageProtocol(protocol)
  const mode = resolveImageViewerMode(protocol)

  useEffect(() => {
    cancelled.current = false
    setEncoded(photos.map(() => null))
    photos.forEach(async (p, i) => {
      try {
        const buf = await getMediaBuffer(p.url)
        if (cancelled.current) return
        const imageBytes = new Uint8Array(buf)
        const resolved =
          mode === 'native' && nativeProtocol
            ? await (async () => {
                const dims =
                  p.width && p.height
                    ? { width: p.width, height: p.height }
                    : await sharp(imageBytes, { failOn: 'none' }).metadata().then(meta => ({
                        width: meta.width ?? 1,
                        height: meta.height ?? 1,
                      }))
                const fitted = fitImageCellsIntoBox({
                  maxCols: THUMB_MAX_WIDTH,
                  maxRows: THUMB_MAX_HEIGHT,
                  imageWidth: dims.width,
                  imageHeight: dims.height,
                })
                return {
                  kind: 'native' as const,
                  protocol: nativeProtocol,
                  sequence: await buildNativeImageSequence(nativeProtocol, imageBytes, {
                    widthCells: fitted.widthCells,
                    heightCells: fitted.heightCells,
                    name: p.url.split('/').pop(),
                  }),
                  widthCells: fitted.widthCells,
                  heightCells: fitted.heightCells,
                }
              })()
            : {
                kind: 'ansi' as const,
                ...(await renderHalfblock(imageBytes, {
                  cols: THUMB_MAX_WIDTH,
                  maxRows: THUMB_MAX_HEIGHT,
                })),
              }
        if (cancelled.current) return
        setEncoded(prev => {
          const next = [...prev]
          next[i] = resolved
          return next
        })
      } catch {
        // Swallow thumbnail errors — the card still renders without the tile.
      }
    })
    return () => {
      cancelled.current = true
    }
  }, [mode, nativeProtocol, photos])

  if (photos.length === 0 && nonPhotos.length === 0) return null

  return (
    <Box flexDirection="row" gap={1} marginTop={1}>
      {photos.map((p, i) => {
        const enc = encoded[i]
        if (!enc) {
          return (
            <Box key={p.url} width={THUMB_MAX_WIDTH} height={THUMB_MAX_HEIGHT} flexShrink={0}>
              <Text color={TW_DIM}>[loading…]</Text>
            </Box>
          )
        }
        if (enc.kind === 'native') {
          return (
            <Box
              key={p.url}
              width={THUMB_MAX_WIDTH}
              height={THUMB_MAX_HEIGHT}
              flexShrink={0}
              justifyContent="center"
              alignItems="center"
              onClick={event => {
                event.stopImmediatePropagation()
                onOpen?.(i)
              }}
            >
              <NativeImageBox
                protocol={enc.protocol}
                paintKey={p.url}
                sequence={enc.sequence}
                widthCells={enc.widthCells}
                heightCells={enc.heightCells}
                debugLabel={`thumb:${p.url}`}
              />
            </Box>
          )
        }
        return (
          <Box
            key={p.url}
            width={THUMB_MAX_WIDTH}
            height={THUMB_MAX_HEIGHT}
            flexShrink={0}
            justifyContent="center"
            alignItems="center"
            flexDirection="column"
            onClick={event => {
              event.stopImmediatePropagation()
              onOpen?.(i)
            }}
          >
            <RawAnsi lines={enc.lines} width={enc.width} />
          </Box>
        )
      })}
      {nonPhotos.map(m => (
        <Box
          key={m.url}
          flexShrink={0}
          width={THUMB_MAX_WIDTH}
          height={THUMB_MAX_HEIGHT}
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
