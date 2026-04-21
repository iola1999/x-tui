#!/usr/bin/env bun
import { resolve } from 'node:path'

const root = import.meta.dir
const result = await Bun.build({
  entrypoints: [resolve(root, 'src/entrypoints/cli.tsx')],
  outdir: resolve(root, 'dist'),
  target: 'bun',
  format: 'esm',
  splitting: true,
  minify: false,
  sourcemap: 'external',
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log(`Built ${result.outputs.length} outputs → dist/`)
