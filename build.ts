#!/usr/bin/env bun
import { chmod } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Produces the `dist/cli.js` single-entry bundle that ships via NPM.
 *
 * Bun inlines @anthropic/ink (workspace-only; never published), React,
 * signal-exit, chalk, wrap-ansi, and the rest. The two deps that MUST stay
 * external are:
 *   - `sharp`: loads platform-specific `@img/sharp-libvips-*` native bindings
 *     via `require()` at runtime — those are optionalDependencies of sharp
 *     and need a real node_modules entry.
 *   - `undici`: its HTTP/2 worker ships as a real file resolved via
 *     `new URL(..., import.meta.url)`, which bundling breaks.
 * These match the `dependencies` block of package.json so `npm i -g x-tui`
 * pulls exactly what the bundle calls into.
 */
const root = import.meta.dir
const result = await Bun.build({
  entrypoints: [resolve(root, 'src/entrypoints/cli.tsx')],
  outdir: resolve(root, 'dist'),
  target: 'bun',
  format: 'esm',
  splitting: true,
  minify: false,
  sourcemap: 'external',
  external: ['sharp', 'undici'],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

// `bin` entry points need the executable bit so `npm i -g` and `npx` can
// invoke them directly without a wrapping shell script.
await chmod(resolve(root, 'dist/cli.js'), 0o755)

console.log(`Built ${result.outputs.length} outputs → dist/`)
