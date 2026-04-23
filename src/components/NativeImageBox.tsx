import type React from 'react'
import { useLayoutEffect, useRef } from 'react'
import { Box, type DOMElement, useTerminalSize } from '@anthropic/ink'
import {
  buildNativeImageClearSequence,
  debugNativeImage,
  measureNativeImagePlacement,
  type NativeImageProtocol,
  runAfterInkRender,
} from '../screens/imageViewerNative.js'

type Props = {
  protocol: NativeImageProtocol
  sequence: string
  widthCells: number
  heightCells: number
  debugLabel?: string
}

export function NativeImageBox({
  protocol,
  sequence,
  widthCells,
  heightCells,
  debugLabel,
}: Props): React.ReactNode {
  const ref = useRef<DOMElement | null>(null)
  const size = useTerminalSize()
  const paintedRef = useRef<{
    row: number
    col: number
    widthCells: number
    heightCells: number
  } | null>(null)
  const drawTokenRef = useRef(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const placement = measureNativeImagePlacement(el, size?.rows ?? 24)
    const nextToken = drawTokenRef.current + 1
    drawTokenRef.current = nextToken
    debugNativeImage('measure', {
      label: debugLabel,
      row: placement.row,
      col: placement.col,
      height: placement.height,
      widthCells,
      heightCells,
      visible: placement.visible,
      terminalRows: size?.rows ?? 24,
    })

    if (!placement.visible) {
      debugNativeImage('skip', {
        label: debugLabel,
        row: placement.row,
        col: placement.col,
        height: placement.height,
        visible: placement.visible,
      })
      return
    }

    runAfterInkRender(() => {
      if (drawTokenRef.current !== nextToken) return
      const latest = ref.current
      if (!latest) return
      const latestPlacement = measureNativeImagePlacement(latest, size?.rows ?? 24)
      if (!latestPlacement.visible) {
        debugNativeImage('skip-after-render', {
          label: debugLabel,
          row: latestPlacement.row,
          col: latestPlacement.col,
          height: latestPlacement.height,
          visible: latestPlacement.visible,
        })
        return
      }
      debugNativeImage('draw', {
        label: debugLabel,
        row: latestPlacement.row,
        col: latestPlacement.col,
        height: latestPlacement.height,
        widthCells,
        heightCells,
      })
      process.stdout.write(
        `\x1b7\x1b[${latestPlacement.row};${latestPlacement.col}H${sequence}\x1b8`,
      )
      paintedRef.current = {
        row: latestPlacement.row,
        col: latestPlacement.col,
        widthCells,
        heightCells,
      }
    })

    return () => {
      drawTokenRef.current += 1
      const painted = paintedRef.current
      if (!painted) return
      debugNativeImage('clear', {
        label: debugLabel,
        protocol,
        row: painted.row,
        col: painted.col,
        widthCells: painted.widthCells,
        heightCells: painted.heightCells,
      })
      process.stdout.write(buildNativeImageClearSequence(protocol, painted))
      paintedRef.current = null
    }
  })

  return <Box ref={ref} flexShrink={0} width={widthCells} height={heightCells} />
}
