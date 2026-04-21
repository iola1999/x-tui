import React, { useEffect, useState } from 'react'
import { Box, RawAnsi, Text, useKeybinding, useRegisterKeybindingContext, useTerminalSize } from '@anthropic/ink'
import { pop } from '../state/store.js'
import { getMediaBuffer } from '../services/mediaCache.js'
import { renderHalfblock } from '../utils/imageEncoders/halfblock.js'
import { LoadingLine } from '../components/Spinner.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

type Props = {
  urls: string[]
  index: number
  tweetId?: string
}

type Rendered = { lines: string[]; width: number; height: number } | null

/**
 * Full-screen halfblock image viewer. v1 uses halfblock rather than
 * iTerm2/Kitty/Sixel because it integrates cleanly with Ink's diff-based
 * renderer (RawAnsi → Yoga leaf). A later revision can swap in protocol
 * encoders when `terminalCaps.protocol !== 'halfblock'`.
 */
export function ImageViewerScreen({ urls, index, tweetId }: Props): React.ReactNode {
  useRegisterKeybindingContext('ImageViewer', true)
  const size = useTerminalSize()
  const [current, setCurrent] = useState(index)
  const [rendered, setRendered] = useState<Rendered>(null)
  const [error, setError] = useState<string | null>(null)

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
    const url = urls[current]
    if (!url) return
    ;(async () => {
      try {
        const buf = await getMediaBuffer(url)
        if (cancelled) return
        // Viewport budget: leave 4 rows for chrome (header + nav hints).
        const cols = Math.max(8, Math.min(size?.columns ?? 80, 160))
        const rows = Math.max(4, (size?.rows ?? 24) - 4)
        const enc = await renderHalfblock(new Uint8Array(buf), { cols, maxRows: rows })
        if (cancelled) return
        setRendered(enc)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [current, urls, size?.columns, size?.rows])

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
        ) : (
          <Box flexDirection="column" flexShrink={0}>
            <RawAnsi lines={rendered.lines} width={rendered.width} />
          </Box>
        )}
      </Box>
    </Box>
  )
}
