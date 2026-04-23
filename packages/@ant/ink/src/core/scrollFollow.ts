export function shouldFollowScrollOnGrowth(opts: {
  sticky: boolean
  grew: boolean
  scrollTopBeforeFollow: number
  prevMaxScroll: number
  pendingScrollDelta: number
}): boolean {
  if (opts.pendingScrollDelta < 0) return false
  if (opts.sticky) return true
  if (!opts.grew) return false
  if (opts.prevMaxScroll <= 0) return false
  return opts.scrollTopBeforeFollow >= opts.prevMaxScroll
}
