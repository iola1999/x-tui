// Ambient module declaration for bun:test. @types/bun provides the real
// types but its triple-slash reference to bun-types doesn't resolve through
// Bun's nested node_modules layout. These signatures mirror the subset we use.

declare module 'bun:test' {
  export const test: (name: string, fn: () => void | Promise<void>) => void
  export const it: typeof test
  export const describe: (name: string, fn: () => void) => void
  export const beforeAll: (fn: () => void | Promise<void>) => void
  export const afterAll: (fn: () => void | Promise<void>) => void
  export const beforeEach: (fn: () => void | Promise<void>) => void
  export const afterEach: (fn: () => void | Promise<void>) => void
  export function expect<T>(actual: T): {
    toBe: (expected: T) => void
    toEqual: (expected: unknown) => void
    toContain: (expected: unknown) => void
    toMatch: (expected: RegExp | string) => void
    toHaveLength: (expected: number) => void
    toBeNull: () => void
    toBeUndefined: () => void
    toBeGreaterThan: (expected: number) => void
    toBeLessThanOrEqual: (expected: number) => void
    not: {
      toThrow: () => void
      toBeNull: () => void
    }
  }
}
