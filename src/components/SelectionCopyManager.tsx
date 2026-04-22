import React, { useEffect, useRef } from 'react'
import { useSelection } from '@anthropic/ink'
import { showToast } from '../state/store.js'

type SelectionState = {
  isDragging: boolean
}

type SelectionApi = {
  subscribe: (cb: () => void) => () => void
  getState: () => SelectionState | null
  hasSelection: () => boolean
  copySelectionNoClear: () => string
}

export function attachCopyOnSelect(
  selection: SelectionApi,
  onCopied?: (text: string) => void,
): () => void {
  let copied = false

  return selection.subscribe(() => {
    const state = selection.getState()
    if (state?.isDragging) {
      copied = false
      return
    }
    if (!selection.hasSelection()) {
      copied = false
      return
    }
    if (copied) return

    const text = selection.copySelectionNoClear()
    copied = true
    if (!text.trim()) return
    onCopied?.(text)
  })
}

export function SelectionCopyManager(): React.ReactNode {
  const selection = useSelection()
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    return attachCopyOnSelect(selectionRef.current, () => {
      showToast('success', 'Selection copied')
    })
  }, [])

  return null
}
