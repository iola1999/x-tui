import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Box,
  RawAnsi,
  Text,
  instances,
  useKeybinding,
  useRegisterKeybindingContext,
  useTerminalSize,
} from '@anthropic/ink'
import sharp from 'sharp'
import { pop } from '../state/store.js'
import { getMediaBuffer } from '../services/mediaCache.js'
import { renderHalfblock } from '../utils/imageEncoders/halfblock.js'
import { encodeITerm2 } from '../utils/imageEncoders/iterm2.js'
import { encodeKitty } from '../utils/imageEncoders/kitty.js'
import { getTerminalCaps } from '../utils/terminalCaps.js'
import { LoadingLine } from '../components/Spinner.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'
import { fitNativeImageBox, resolveImageViewerMode } from './imageViewerNative.js'

type Props = {
  urls: string[]
  index: number
  tweetId?: string
}

type AnsiRendered = {
  kind: 'ansi'
  lines: string[]
  width: number
  height: number
}

type NativeRendered = {
  kind: 'native'
  sequence: string
  row: number
  col: number
  widthCells: number
  heightCells: number
}

type Rendered = AnsiRendered | NativeRendered | null

export function ImageViewerScreen({ urls, index, tweetId }: Props): React.ReactNode {
  useRegisterKeybindingContext('ImageViewer', true)
  const size = useTerminalSize()
  const [current, setCurrent] = useState(index)
  const [rendered, setRendered] = useState<Rendered>(null)
  const [error, setError] = useState<string | null>(null)
  const nativeDrawnRef = useRef(false)
  const protocol = getTerminalCaps().protocol
  const mode = resolveImageViewerMode(protocol)

  const close = () => {
    pop()
  }
  const prev = () => setCurrent(c => (c - 1 + urls.length) % urls.length)
  const next = () => setCurrent(c => (c + 1) % urls.length)

  useKeybinding('image:close', close, { context: 'ImageViewer' })
  useKeybinding('image:prev', prev, { context: 'ImageViewer' })
  useKeybinding('image:next', next, { context: 'ImageViewer' })

  useEffect(() => {
    let cancelled = false
    setRendered(null)
    setError(null)
    if (nativeDrawnRef.current) {
      instances.get(process.stdout)?.forceRedraw()
      nativeDrawnRef.current = false
    }
    const url = urls[current]
    if (!url) return
    ;(async () => {
      try {
        const buf = await getMediaBuffer(url)
        if (cancelled) return
        const imageBytes = new Uint8Array(buf)
        if (mode === 'native') {
          const img = sharp(imageBytes, { failOn: 'none' })
          const meta = await img.metadata()
          if (cancelled) return
          const box = fitNativeImageBox({
            columns: size?.columns ?? 80,
            rows: size?.rows ?? 24,
            imageWidth: meta.width ?? 1,
            imageHeight: meta.height ?? 1,
          })
          const sequence =
            protocol === 'kitty'
              ? encodeKitty(
                  new Uint8Array(await img.png().toBuffer()),
                  { widthCells: box.widthCells, heightCells: box.heightCells },
                )
              : encodeITerm2(imageBytes, {
                  widthCells: box.widthCells,
                  heightCells: box.heightCells,
                  name: url.split('/').pop(),
                })
          if (cancelled) return
          setRendered({ kind: 'native', sequence, ...box })
          return
        }
        const cols = Math.max(8, Math.min(size?.columns ?? 80, 160))
        const rows = Math.max(4, (size?.rows ?? 24) - 4)
        const enc = await renderHalfblock(imageBytes, { cols, maxRows: rows })
        if (cancelled) return
        setRendered({ kind: 'ansi', ...enc })
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [current, mode, protocol, size?.columns, size?.rows, urls])

  useLayoutEffect(() => {
    if (!rendered || rendered.kind !== 'native') return
    process.stdout.write(
      `\x1b7\x1b[${rendered.row};${rendered.col}H${rendered.sequence}\x1b8`,
    )
    nativeDrawnRef.current = true
  }, [rendered])

  useEffect(
    () => () => {
      if (!nativeDrawnRef.current) return
      queueMicrotask(() => {
        instances.get(process.stdout)?.forceRedraw()
      })
    },
    [],
  )

  const url = urls[current] ?? ''

  return (
    <Box flexDirection="column" width="100%" height="100%" padding={1}>
      <Box flexShrink={0} flexDirection="row" justifyContent="space-between">
        <Text color={TW_BLUE} bold>
          Image {current + 1} / {urls.length}
          {tweetId ? ` · tweet ${tweetId}` : ''}
        </Text>
        <Text color={TW_DIM}>h/← prev · l/→ next · Esc close</Text>
      </Box>
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        {error ? (
          <Text color="error">Error: {error}</Text>
        ) : !rendered ? (
          <LoadingLine label={url ? `Loading ${url}` : 'Loading image'} />
        ) : rendered.kind === 'native' ? (
          <Box
            flexShrink={0}
            width={rendered.widthCells}
            height={rendered.heightCells}
          />
        ) : (
          <Box flexDirection="column" flexShrink={0}>
            <RawAnsi lines={rendered.lines} width={rendered.width} />
          </Box>
        )}
      </Box>
    </Box>
  )
}
