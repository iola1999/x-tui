import type React from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Box, type DOMElement, useTerminalSize } from '@anthropic/ink'
import {
  buildNativeImageClearSequence,
  debugNativeImage,
  describeNativeImageElement,
  measureNativeImagePlacement,
  subscribeAfterEveryInkRenderForElement,
  type NativeImagePaintedState,
  type NativeImageProtocol,
  runAfterInkRenderForElement,
  shouldReuseNativeImagePaint,
} from '../screens/imageViewerNative.js'

type Props = {
  protocol: NativeImageProtocol
  paintKey: string
  sequence: string
  widthCells: number
  heightCells: number
  debugLabel?: string
}

const MAX_LAYOUT_SETTLE_PASSES = 3
const LAYOUT_SETTLE_DELAY_MS = 8

export function NativeImageBox({
  protocol,
  paintKey,
  sequence,
  widthCells,
  heightCells,
  debugLabel,
}: Props): React.ReactNode {
  const ref = useRef<DOMElement | null>(null)
  const size = useTerminalSize()
  const paintedRef = useRef<NativeImagePaintedState | null>(null)
  const drawTokenRef = useRef(0)
  const instanceIdRef = useRef(`native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instanceId = instanceIdRef.current

  const cancelPendingSettle = useCallback((): void => {
    const timer = settleTimerRef.current
    if (!timer) return
    clearTimeout(timer)
    settleTimerRef.current = null
  }, [])

  const clearPainted = useCallback((): void => {
    const painted = paintedRef.current
    if (!painted) return
    debugNativeImage('clear', {
      label: debugLabel,
      instanceId,
      protocol: painted.protocol,
      row: painted.row,
      col: painted.col,
      widthCells: painted.widthCells,
      heightCells: painted.heightCells,
    })
    process.stdout.write(buildNativeImageClearSequence(painted.protocol, painted))
    paintedRef.current = null
  }, [debugLabel, instanceId])

  const scheduleDraw = useCallback(
    (
      drawToken: number,
      baselinePlacement: { row: number; col: number; height: number; visible: boolean },
      attempt: number,
    ): void => {
      const scheduledFrom = ref.current
      if (!scheduledFrom) return
      debugNativeImage('schedule-after-render', {
        label: debugLabel,
        instanceId,
        drawToken,
        attempt,
        baselineRow: baselinePlacement.row,
        baselineCol: baselinePlacement.col,
        baselineHeight: baselinePlacement.height,
        baselineVisible: baselinePlacement.visible,
        widthCells,
        heightCells,
        ...describeNativeImageElement(scheduledFrom),
      })
      runAfterInkRenderForElement(scheduledFrom, () => {
        if (drawTokenRef.current !== drawToken) return
        const latest = ref.current
        if (!latest) return
        const latestPlacement = measureNativeImagePlacement(latest, size?.rows ?? 24)
        const latestDebug = describeNativeImageElement(latest)
        if (!latestPlacement.visible) {
          debugNativeImage('skip-after-render', {
            label: debugLabel,
            instanceId,
            drawToken,
            attempt,
            row: latestPlacement.row,
            col: latestPlacement.col,
            height: latestPlacement.height,
            visible: latestPlacement.visible,
            ...latestDebug,
          })
          clearPainted()
          return
        }

        if (
          attempt < MAX_LAYOUT_SETTLE_PASSES &&
          (latestPlacement.row !== baselinePlacement.row ||
            latestPlacement.col !== baselinePlacement.col)
        ) {
          debugNativeImage('defer-layout-shift', {
            label: debugLabel,
            instanceId,
            drawToken,
            attempt,
            fromRow: baselinePlacement.row,
            fromCol: baselinePlacement.col,
            toRow: latestPlacement.row,
            toCol: latestPlacement.col,
            ...latestDebug,
          })
          cancelPendingSettle()
          const timer = setTimeout(() => {
            settleTimerRef.current = null
            scheduleDraw(drawToken, latestPlacement, attempt + 1)
          }, LAYOUT_SETTLE_DELAY_MS)
          timer.unref?.()
          settleTimerRef.current = timer
          return
        }

        const latestPaint: NativeImagePaintedState = {
          protocol,
          paintKey,
          row: latestPlacement.row,
          col: latestPlacement.col,
          widthCells,
          heightCells,
        }
        if (shouldReuseNativeImagePaint(paintedRef.current, latestPaint)) {
          debugNativeImage('reuse-after-render', {
            label: debugLabel,
            instanceId,
            drawToken,
            attempt,
            row: latestPlacement.row,
            col: latestPlacement.col,
            widthCells,
            heightCells,
            ...latestDebug,
          })
          return
        }
        clearPainted()
        debugNativeImage('draw', {
          label: debugLabel,
          instanceId,
          drawToken,
          attempt,
          row: latestPlacement.row,
          col: latestPlacement.col,
          height: latestPlacement.height,
          widthCells,
          heightCells,
          ...latestDebug,
        })
        process.stdout.write(
          `\x1b7\x1b[${latestPlacement.row};${latestPlacement.col}H${sequence}\x1b8`,
        )
        paintedRef.current = latestPaint
      })
    },
    [
      cancelPendingSettle,
      clearPainted,
      debugLabel,
      heightCells,
      instanceId,
      paintKey,
      protocol,
      sequence,
      size?.rows,
      widthCells,
    ],
  )

  const requestDraw = useCallback((): void => {
    const el = ref.current
    if (!el) return
    const placement = measureNativeImagePlacement(el, size?.rows ?? 24)
    const nextToken = drawTokenRef.current + 1
    drawTokenRef.current = nextToken
    debugNativeImage('measure', {
      label: debugLabel,
      instanceId,
      drawToken: nextToken,
      row: placement.row,
      col: placement.col,
      height: placement.height,
      widthCells,
      heightCells,
      visible: placement.visible,
      terminalRows: size?.rows ?? 24,
      ...describeNativeImageElement(el),
    })

    if (!placement.visible) {
      debugNativeImage('skip', {
        label: debugLabel,
        instanceId,
        drawToken: nextToken,
        row: placement.row,
        col: placement.col,
        height: placement.height,
        visible: placement.visible,
        ...describeNativeImageElement(el),
      })
      clearPainted()
      return
    }

    const nextPaint: NativeImagePaintedState = {
      protocol,
      paintKey,
      row: placement.row,
      col: placement.col,
      widthCells,
      heightCells,
    }

    if (shouldReuseNativeImagePaint(paintedRef.current, nextPaint)) {
      debugNativeImage('reuse', {
        label: debugLabel,
        instanceId,
        drawToken: nextToken,
        row: placement.row,
        col: placement.col,
        widthCells,
        heightCells,
        ...describeNativeImageElement(el),
      })
      return
    }

    clearPainted()
    scheduleDraw(nextToken, placement, 0)
  }, [
    clearPainted,
    debugLabel,
    heightCells,
    instanceId,
    paintKey,
    protocol,
    scheduleDraw,
    size?.rows,
    widthCells,
  ])

  useLayoutEffect(() => {
    cancelPendingSettle()
    requestDraw()
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return subscribeAfterEveryInkRenderForElement(el, requestDraw)
  }, [requestDraw])

  useEffect(
    () => () => {
      drawTokenRef.current += 1
      cancelPendingSettle()
      clearPainted()
    },
    [cancelPendingSettle, clearPainted],
  )

  return <Box ref={ref} flexShrink={0} width={widthCells} height={heightCells} />
}
