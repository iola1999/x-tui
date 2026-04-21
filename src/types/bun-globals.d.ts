// Minimal global declaration for Bun APIs used by @anthropic/ink fallback paths.
// The real types come from bun-types, but its nested install path isn't resolved
// by tsc in this workspace. These signatures mirror the upstream Bun types.
// x-tui's own code imports Bun APIs explicitly where needed.

declare global {
  const Bun: {
    readonly stringWidth?: (str: string, options?: { ambiguousIsNarrow?: boolean }) => number
    readonly wrapAnsi?: (
      str: string,
      cols: number,
      options?: { trim?: boolean; wordWrap?: boolean; hard?: boolean },
    ) => string
    readonly spawn: (options: {
      cmd: string[]
      stdin?: 'inherit' | 'ignore' | 'pipe' | ReadableStream | Blob | ArrayBufferView
      stdout?: 'inherit' | 'ignore' | 'pipe'
      stderr?: 'inherit' | 'ignore' | 'pipe'
      env?: Record<string, string | undefined>
      cwd?: string
      onExit?: (subprocess: unknown, exitCode: number | null, signalCode: string | null, error: Error | null) => void | Promise<void>
    }) => {
      readonly stdout: ReadableStream
      readonly stderr: ReadableStream
      readonly stdin: WritableStream
      readonly exited: Promise<number>
      readonly exitCode: number | null
      kill: (signal?: string | number) => void
    }
    readonly build: (opts: Record<string, unknown>) => Promise<{
      success: boolean
      outputs: Array<{ path: string }>
      logs: unknown[]
    }>
  }
}

export {}
