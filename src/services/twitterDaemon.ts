type TwitterDaemonStdin =
  | WritableStream<Uint8Array>
  | {
      write: (chunk: Uint8Array | string) => unknown
      end?: () => void
      flush?: () => unknown
    }

type DaemonWriter = {
  write: (chunk: Uint8Array) => Promise<void>
}

export type TwitterDaemonProcess = {
  stdin: TwitterDaemonStdin | null
  stdout: ReadableStream<Uint8Array> | null
  stderr: ReadableStream<Uint8Array> | null
  exited: Promise<number>
  kill: (signal?: string) => void
}

type DaemonEnvelope<T> =
  | { id: string; ok: true; result: T }
  | { id: string | null; ok: false; error?: { message?: string } }

type Pending = {
  resolve: (value: any) => void
  reject: (reason?: unknown) => void
}

export class TwitterDaemonRemoteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TwitterDaemonRemoteError'
  }
}

export class TwitterDaemonTransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TwitterDaemonTransportError'
  }
}

export class TwitterDaemonClient {
  #spawn: () => TwitterDaemonProcess
  #proc: TwitterDaemonProcess | null = null
  #writer: DaemonWriter | null = null
  #pending = new Map<string, Pending>()
  #starting: Promise<void> | null = null
  #nextId = 1
  #stderrTail = ''

  constructor(spawn: () => TwitterDaemonProcess) {
    this.#spawn = spawn
  }

  async request<T>(op: string, params: Record<string, unknown>): Promise<T> {
    await this.#ensureStarted()
    const id = String(this.#nextId++)
    const pending = new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
    })
    try {
      await this.#writer!.write(new TextEncoder().encode(`${JSON.stringify({ id, op, params })}\n`))
    } catch (err) {
      this.#pending.delete(id)
      throw new TwitterDaemonTransportError((err as Error).message)
    }
    return pending
  }

  close(): void {
    try {
      this.#proc?.kill('SIGTERM')
    } catch {
      // best-effort
    }
  }

  async #ensureStarted(): Promise<void> {
    if (this.#proc && this.#writer) return
    if (this.#starting) return this.#starting
    this.#starting = this.#start()
    try {
      await this.#starting
    } finally {
      this.#starting = null
    }
  }

  async #start(): Promise<void> {
    let proc: TwitterDaemonProcess
    try {
      proc = this.#spawn()
    } catch (err) {
      throw new TwitterDaemonTransportError((err as Error).message)
    }
    if (!proc.stdin || !proc.stdout) {
      throw new TwitterDaemonTransportError('twitter daemon requires piped stdin/stdout')
    }

    this.#proc = proc
    this.#writer = this.#wrapWriter(proc.stdin)
    void this.#readLoop(proc.stdout)
    if (proc.stderr) void this.#readStderr(proc.stderr)
    void proc.exited.then(code => this.#handleExit(code))
  }

  #wrapWriter(stdin: TwitterDaemonStdin): DaemonWriter {
    if ('getWriter' in stdin && typeof stdin.getWriter === 'function') {
      return stdin.getWriter()
    }
    if ('write' in stdin && typeof stdin.write === 'function') {
      return {
        write: async (chunk: Uint8Array) => {
          await Promise.resolve(stdin.write(chunk))
          if ('flush' in stdin && typeof stdin.flush === 'function') {
            await Promise.resolve(stdin.flush())
          }
        },
      }
    }
    throw new TwitterDaemonTransportError('twitter daemon stdin is not writable')
  }

  async #readLoop(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader()
    let buffered = ''
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        buffered += new TextDecoder().decode(value)
        while (true) {
          const nl = buffered.indexOf('\n')
          if (nl < 0) break
          const line = buffered.slice(0, nl).trim()
          buffered = buffered.slice(nl + 1)
          if (line) this.#handleLine(line)
        }
      }
      if (buffered.trim()) this.#handleLine(buffered.trim())
    } catch (err) {
      this.#rejectAll(new TwitterDaemonTransportError((err as Error).message))
    }
  }

  async #readStderr(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      this.#stderrTail += new TextDecoder().decode(value)
      if (this.#stderrTail.length > 4000) {
        this.#stderrTail = this.#stderrTail.slice(-4000)
      }
    }
  }

  #handleLine(line: string): void {
    let msg: DaemonEnvelope<unknown>
    try {
      msg = JSON.parse(line) as DaemonEnvelope<unknown>
    } catch (err) {
      this.#rejectAll(new TwitterDaemonTransportError(`twitter daemon produced invalid JSON: ${(err as Error).message}`))
      return
    }
    if (!msg.ok) {
      const pending = msg.id ? this.#pending.get(msg.id) : null
      if (pending && msg.id) this.#pending.delete(msg.id)
      const error = new TwitterDaemonRemoteError(msg.error?.message ?? 'twitter daemon request failed')
      if (pending) pending.reject(error)
      return
    }
    const pending = this.#pending.get(msg.id)
    if (!pending) return
    this.#pending.delete(msg.id)
    pending.resolve(msg.result)
  }

  #handleExit(code: number): void {
    this.#writer = null
    this.#proc = null
    const suffix = this.#stderrTail.trim() ? `: ${this.#stderrTail.trim()}` : ''
    this.#rejectAll(new TwitterDaemonTransportError(`twitter daemon exited ${code}${suffix}`))
  }

  #rejectAll(err: Error): void {
    for (const { reject } of this.#pending.values()) reject(err)
    this.#pending.clear()
  }
}
