/**
 * Twitter-flavored palette on top of @anthropic/ink's dark theme.
 *
 * Ink's theme keys are baked in ('claude', 'permission', 'success', etc.) — for
 * x-tui we stay on the dark palette and reach for a handful of raw RGB values
 * when we want a visibly Twitter-blue accent instead of Claude orange.
 */
export const TW_BLUE = 'rgb(29,155,240)' // Twitter/X brand blue
export const TW_BLUE_DIM = 'rgb(21,112,174)'
export const TW_LIKE = 'rgb(249,24,128)' // heart / like pink
export const TW_RETWEET = 'rgb(0,186,124)' // retweet green
export const TW_BOOKMARK = 'rgb(29,155,240)' // bookmark uses accent blue
export const TW_WARN = 'rgb(255,193,7)'
export const TW_DIM = 'rgb(113,118,123)' // meta text
export const TW_SUBTLE = 'rgb(83,100,113)' // borders
