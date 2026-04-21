import { describe, expect, test } from 'bun:test'
import { compactNumber, formatRelative } from '../time.js'

describe('formatRelative', () => {
  test('seconds', () => {
    const now = Date.now()
    expect(formatRelative(new Date(now - 5000).toISOString(), now)).toBe('5s')
  })
  test('minutes', () => {
    const now = Date.now()
    expect(formatRelative(new Date(now - 90 * 1000).toISOString(), now)).toBe('1m')
    expect(formatRelative(new Date(now - 59 * 60 * 1000).toISOString(), now)).toBe('59m')
  })
  test('hours', () => {
    const now = Date.now()
    expect(formatRelative(new Date(now - 5 * 3600 * 1000).toISOString(), now)).toBe('5h')
  })
  test('days', () => {
    const now = Date.now()
    expect(formatRelative(new Date(now - 3 * 86400 * 1000).toISOString(), now)).toBe('3d')
  })
  test('weeks', () => {
    const now = Date.now()
    expect(formatRelative(new Date(now - 14 * 86400 * 1000).toISOString(), now)).toBe('2w')
  })
  test('months and years', () => {
    const now = Date.now()
    // 60 days ≈ 2 months (floor(60/30))
    expect(formatRelative(new Date(now - 60 * 86400 * 1000).toISOString(), now)).toBe('2mo')
    // 400 days = 1 year (floor(400/365))
    expect(formatRelative(new Date(now - 400 * 86400 * 1000).toISOString(), now)).toBe('1y')
  })
  test('returns empty string for missing or invalid input', () => {
    expect(formatRelative(undefined)).toBe('')
    expect(formatRelative('not-a-date')).toBe('')
  })
  test('clamps negative diffs to 0s (clock skew)', () => {
    const now = Date.now()
    expect(formatRelative(new Date(now + 60_000).toISOString(), now)).toBe('0s')
  })
})

describe('compactNumber', () => {
  test('small numbers stay as-is', () => {
    expect(compactNumber(0)).toBe('0')
    expect(compactNumber(42)).toBe('42')
    expect(compactNumber(999)).toBe('999')
  })
  test('thousands', () => {
    expect(compactNumber(1_000)).toBe('1.0K')
    expect(compactNumber(1_200)).toBe('1.2K')
    expect(compactNumber(9_500)).toBe('9.5K')
    expect(compactNumber(10_000)).toBe('10K')
    expect(compactNumber(999_000)).toBe('999K')
  })
  test('millions', () => {
    expect(compactNumber(1_000_000)).toBe('1.0M')
    expect(compactNumber(1_200_000)).toBe('1.2M')
    expect(compactNumber(10_000_000)).toBe('10M')
  })
})
