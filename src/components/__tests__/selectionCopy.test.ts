import { describe, expect, it } from 'bun:test'
import { attachCopyOnSelect } from '../SelectionCopyManager.js'

type FakeSelection = {
  isDragging: boolean
}

function makeSelection() {
  let state: FakeSelection | null = null
  let hasSelection = false
  let copied = ''
  const listeners = new Set<() => void>()

  return {
    api: {
      subscribe(cb: () => void) {
        listeners.add(cb)
        return () => listeners.delete(cb)
      },
      getState() {
        return state
      },
      hasSelection() {
        return hasSelection
      },
      copySelectionNoClear() {
        copied += 'copied'
        return copied
      },
    },
    set(next: { state: FakeSelection | null; has: boolean }) {
      state = next.state
      hasSelection = next.has
      for (const l of listeners) l()
    },
  }
}

describe('attachCopyOnSelect', () => {
  it('copies once when a drag selection settles', () => {
    const selection = makeSelection()
    let copiedText = ''

    const detach = attachCopyOnSelect(selection.api, text => {
      copiedText = text
    })

    selection.set({ state: { isDragging: true }, has: false })
    selection.set({ state: { isDragging: false }, has: true })
    selection.set({ state: { isDragging: false }, has: true })

    expect(copiedText).toBe('copied')
    detach()
  })

  it('resets after selection is cleared so the next drag copies again', () => {
    const selection = makeSelection()
    let copyCount = 0

    const detach = attachCopyOnSelect(selection.api, () => {
      copyCount += 1
    })

    selection.set({ state: { isDragging: true }, has: false })
    selection.set({ state: { isDragging: false }, has: true })
    selection.set({ state: null, has: false })
    selection.set({ state: { isDragging: true }, has: false })
    selection.set({ state: { isDragging: false }, has: true })

    expect(copyCount).toBe(2)
    detach()
  })
})
