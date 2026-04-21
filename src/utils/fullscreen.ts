import { getIsInteractive } from '../bootstrap/state.js'

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])
const FALSY = new Set(['0', 'false', 'no', 'off'])

function isEnvTruthy(v: string | undefined): boolean {
  return v !== undefined && TRUTHY.has(v.toLowerCase())
}
function isEnvFalsy(v: string | undefined): boolean {
  return v !== undefined && FALSY.has(v.toLowerCase())
}

/**
 * Whether the alt-screen fullscreen layout should render. Defaults ON when
 * interactive; opt out with X_TUI_NO_FLICKER=0.
 *
 * Mirrors claude-code's CLAUDE_CODE_NO_FLICKER=1 "on" path — everything the
 * user asked us to follow. The old-style scrollback mode is only for debug/CI.
 */
export function isFullscreenEnvEnabled(): boolean {
  if (isEnvFalsy(process.env.X_TUI_NO_FLICKER)) return false
  return true
}

export function isFullscreenActive(): boolean {
  return getIsInteractive() && isFullscreenEnvEnabled()
}

/** SGR mouse tracking; set X_TUI_DISABLE_MOUSE=1 to keep terminal copy-on-select. */
export function isMouseTrackingEnabled(): boolean {
  return !isEnvTruthy(process.env.X_TUI_DISABLE_MOUSE)
}

/** Ignore clicks/drags but keep wheel. Set X_TUI_DISABLE_MOUSE_CLICKS=1. */
export function isMouseClicksDisabled(): boolean {
  return isEnvTruthy(process.env.X_TUI_DISABLE_MOUSE_CLICKS)
}
