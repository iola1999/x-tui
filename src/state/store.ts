/**
 * Tiny external-store-style state container.
 *
 * Components subscribe via `useStore(selector)` built on useSyncExternalStore —
 * we keep it minimal to avoid pulling Zustand while still getting stable
 * selectors and batched notifications.
 */
import { useSyncExternalStore } from 'react'

export type TabName = 'feed' | 'search' | 'bookmarks' | 'profile'

/** One screen on the per-tab navigation stack. */
export type Screen =
  | { kind: 'feed' }
  | { kind: 'search' }
  | { kind: 'bookmarks' }
  | { kind: 'profile'; handle?: string }
  | { kind: 'tweet'; id: string }
  | { kind: 'imageViewer'; urls: string[]; index: number; tweetId?: string }
  | { kind: 'compose'; mode: ComposeMode }
  | { kind: 'help' }

export type ComposeMode =
  | { kind: 'new' }
  | { kind: 'reply'; inReplyTo: { id: string; text: string; author: string } }
  | { kind: 'quote'; quoted: { id: string; text: string; author: string } }

export type ToastKind = 'info' | 'success' | 'error'
export type Toast = { id: number; kind: ToastKind; text: string; expiresAt: number }

export type BootErrorKind = 'cliMissing' | 'notLoggedIn' | 'other'
export type BootError = { kind: BootErrorKind; message: string }

export type AppState = {
  activeTab: TabName
  /** Screen stack per tab — top of stack is rendered. */
  stacks: Record<TabName, Screen[]>
  toasts: Toast[]
  /** Set by the boot probe (or any screen that hits a fatal CLI failure).
   *  When non-null the BootGate takes over the content area until the user
   *  re-runs the probe (Ctrl+R). */
  bootError: BootError | null
}

const ROOT_SCREEN: Record<TabName, Screen> = {
  feed: { kind: 'feed' },
  search: { kind: 'search' },
  bookmarks: { kind: 'bookmarks' },
  profile: { kind: 'profile' },
}

let state: AppState = {
  activeTab: 'feed',
  stacks: {
    feed: [ROOT_SCREEN.feed],
    search: [ROOT_SCREEN.search],
    bookmarks: [ROOT_SCREEN.bookmarks],
    profile: [ROOT_SCREEN.profile],
  },
  toasts: [],
  bootError: null,
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function setState(next: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const patch = typeof next === 'function' ? next(state) : next
  state = { ...state, ...patch }
  emit()
}

export function getState(): AppState {
  return state
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => selector(state),
    () => selector(state),
  )
}

// -- Navigation actions -------------------------------------------------------

export function setActiveTab(tab: TabName): void {
  setState({ activeTab: tab })
}

export function push(screen: Screen): void {
  setState(s => ({
    stacks: { ...s.stacks, [s.activeTab]: [...s.stacks[s.activeTab], screen] },
  }))
}

export function updateCurrentImageViewerIndex(index: number): void {
  const { activeTab, stacks } = state
  const stack = stacks[activeTab]
  const top = stack[stack.length - 1]
  if (!top || top.kind !== 'imageViewer' || top.index === index) return

  setState({
    stacks: {
      ...stacks,
      [activeTab]: [...stack.slice(0, -1), { ...top, index }],
    },
  })
}

/** Pop current screen. Returns true if a pop happened (tab stack had depth >1). */
export function pop(): boolean {
  const { stacks, activeTab } = state
  const stack = stacks[activeTab]
  if (stack.length <= 1) return false
  setState({ stacks: { ...stacks, [activeTab]: stack.slice(0, -1) } })
  return true
}

export function currentScreen(): Screen {
  const stack = state.stacks[state.activeTab]
  return stack[stack.length - 1]!
}

/** Replace the root screen of a tab in place (e.g. profile → other handle). */
export function replaceRoot(tab: TabName, screen: Screen): void {
  setState(s => ({ stacks: { ...s.stacks, [tab]: [screen] } }))
}

// -- Toast actions ------------------------------------------------------------

let _toastId = 1
const TOAST_TTL_MS = 2500

export function showToast(kind: ToastKind, text: string): void {
  const id = _toastId++
  const expiresAt = Date.now() + TOAST_TTL_MS
  setState(s => ({ toasts: [...s.toasts, { id, kind, text, expiresAt }] }))
  // .unref() so an idle toast never holds the event loop open on app quit —
  // without it, a fresh toast would delay `process.exit` by up to TOAST_TTL_MS.
  const timer = setTimeout(() => dismissToast(id), TOAST_TTL_MS + 50)
  timer.unref?.()
}

export function dismissToast(id: number): void {
  setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
}

export function setBootError(err: BootError | null): void {
  setState({ bootError: err })
}
