#!/usr/bin/env bun
/**
 * Dev runner — spawns cli.tsx under Bun with args passthrough.
 * Keeps stdin/stdout inherited so TUI raw-mode and alt-screen work.
 */
import { spawn } from 'bun'
import { resolve } from 'node:path'

const entry = resolve(import.meta.dir, '..', 'src', 'entrypoints', 'cli.tsx')
const args = process.argv.slice(2)

const proc = spawn({
  cmd: ['bun', 'run', entry, ...args],
  stdio: ['inherit', 'inherit', 'inherit'],
  env: { ...process.env, X_TUI_DEV: '1' },
})

const code = await proc.exited
process.exit(code)
