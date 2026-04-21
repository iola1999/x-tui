import React from 'react'
import { Box, type Color, Text, useAnimationFrame } from '@anthropic/ink'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

/**
 * Spinner glyph + loading line. Draws from claude-code's spinner design:
 *   - shared-clock animation at 120ms tick
 *   - bounce effect (forward frames + reverse)
 *   - reduced-motion fallback so the glyph is still visible without ticks
 *
 * `FRAMES` are lifted verbatim from claude-code's default characters
 * (`['·', '✢', '✱', '✶', '✻', '✽']`). ✱ is used instead of ✳ because
 * emoji-regex matches ✳, which makes stringWidth return 2 and causes
 * layout jitter when the spinner cycles. ✽ works on macOS + Linux; the
 * ghostty-specific substitution is skipped here to keep the module tiny.
 */
const FRAMES_FORWARD = ['·', '✢', '✱', '✶', '✻', '✽'] as const
export const FRAMES: ReadonlyArray<string> = [
  ...FRAMES_FORWARD,
  ...[...FRAMES_FORWARD].reverse(),
]
export const SPINNER_INTERVAL_MS = 120

export function Spinner({ color = TW_BLUE }: { color?: Color } = {}): React.ReactNode {
  const reducedMotion = process.env.X_TUI_REDUCED_MOTION === '1'
  const [ref, time] = useAnimationFrame(reducedMotion ? null : SPINNER_INTERVAL_MS)
  if (reducedMotion) {
    return (
      <Box ref={ref} width={1} height={1}>
        <Text color={color}>●</Text>
      </Box>
    )
  }
  const frame = Math.floor(time / SPINNER_INTERVAL_MS) % FRAMES.length
  return (
    <Box ref={ref} width={1} height={1}>
      <Text color={color}>{FRAMES[frame]}</Text>
    </Box>
  )
}

/**
 * One-line loading indicator. Used as the in-list loading footer and the
 * detail-screen header refresh indicator.
 */
export function LoadingLine({
  label,
  tip,
}: {
  label?: string
  tip?: string
}): React.ReactNode {
  return (
    <Box flexDirection="row" gap={1}>
      <Spinner />
      <Text color={TW_DIM}>{label ?? 'Loading'}</Text>
      {tip ? <Text color={TW_DIM}>· {tip}</Text> : null}
    </Box>
  )
}
