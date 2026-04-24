import type React from 'react'
import { useEffect, useState } from 'react'
import { Box, RawAnsi, Text, useKeybinding, useRegisterKeybindingContext, useTerminalSize } from '@anthropic/ink'
import sharp from 'sharp'
import { pop, updateCurrentImageViewerIndex } from '../state/store.js'
import { getMediaBuffer } from '../services/mediaCache.js'
import { renderHalfblock } from '../utils/imageEncoders/halfblock.js'
import { getTerminalCaps } from '../utils/terminalCaps.js'
import { LoadingLine } from '../components/Spinner.js'
import { NativeImageBox } from '../components/NativeImageBox.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'
import {
  buildNativeImageSequence,
  fitNativeImageBox,
  type NativeImageProtocol,
  resolveNativeImageProtocol,
  resolveImageViewerMode,
} from './imageViewerNative.js'

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
  protocol: NativeImageProtocol
  sequence: string
  widthCells: number
  heightCells: number
}

type Rendered = AnsiRendered | NativeRendered | null

export function ImageViewerScreen({ urls, index, tweetId }: Props): React.ReactNode {
  useRegisterKeybindingContext('ImageViewer', true)
  const size = useTerminalSize()
  const [rendered, setRendered] = useState<Rendered>(null)
  const [error, setError] = useState<string | null>(null)
  const protocol = getTerminalCaps().protocol
  const nativeProtocol = resolveNativeImageProtocol(protocol)
  const mode = resolveImageViewerMode(protocol)
  const current = index

  const close = () => {
    pop()
  }
  const prev = () => updateCurrentImageViewerIndex((current - 1 + urls.length) % urls.length)
  const next = () => updateCurrentImageViewerIndex((current + 1) % urls.length)

  useKeybinding('image:close', close, { context: 'ImageViewer' })
  useKeybinding('image:prev', prev, { context: 'ImageViewer' })
  useKeybinding('image:next', next, { context: 'ImageViewer' })

  useEffect(() => {
    let cancelled = false
    setRendered(null)
    setError(null)
    const url = urls[current]
    if (!url) return
    ;(async () => {
      try {
        const buf = await getMediaBuffer(url)
        if (cancelled) return
        const imageBytes = new Uint8Array(buf)
        if (mode === 'native' && nativeProtocol) {
          const probe = await sharp(imageBytes, { failOn: 'none' }).metadata()
          if (cancelled) return
          const box = fitNativeImageBox({
            columns: size?.columns ?? 80,
            rows: size?.rows ?? 24,
            imageWidth: probe.width ?? 1,
            imageHeight: probe.height ?? 1,
          })
          const sequence = await buildNativeImageSequence(nativeProtocol, imageBytes, {
            widthCells: box.widthCells,
            heightCells: box.heightCells,
            name: url.split('/').pop(),
          })
          if (cancelled) return
          setRendered({
            kind: 'native',
            protocol: nativeProtocol,
            sequence,
            widthCells: box.widthCells,
            heightCells: box.heightCells,
          })
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
  }, [current, mode, nativeProtocol, size?.columns, size?.rows, urls])

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
          <NativeImageBox
            protocol={rendered.protocol}
            paintKey={url}
            sequence={rendered.sequence}
            widthCells={rendered.widthCells}
            heightCells={rendered.heightCells}
            debugLabel={`viewer:${url}`}
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
