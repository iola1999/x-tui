import { describe, expect, it } from 'bun:test'
import { TwitterDaemonClient, type TwitterDaemonProcess } from '../twitterDaemon.js'

function makeFakeProcess(): {
  process: TwitterDaemonProcess
  writes: string[]
  pushResponse: (value: unknown) => void
  finish: (code?: number) => void
} {
  const writes: string[] = []
  let stdoutController!: ReadableStreamDefaultController<Uint8Array>
  let resolveExit!: (code: number) => void

  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      stdoutController = controller
    },
  })
  const stderr = new ReadableStream<Uint8Array>()
  const stdin = new WritableStream<Uint8Array>({
    write(chunk) {
      writes.push(new TextDecoder().decode(chunk))
    },
  })
  const exited = new Promise<number>(resolve => {
    resolveExit = resolve
  })

  return {
    process: {
      stdin,
      stdout,
      stderr,
      exited,
      kill() {},
    },
    writes,
    pushResponse(value: unknown) {
      stdoutController.enqueue(new TextEncoder().encode(`${JSON.stringify(value)}\n`))
    },
    finish(code = 0) {
      stdoutController.close()
      resolveExit(code)
    },
  }
}

function makeFileSinkProcess(): {
  process: TwitterDaemonProcess
  writes: string[]
  pushResponse: (value: unknown) => void
  finish: (code?: number) => void
} {
  const writes: string[] = []
  let stdoutController!: ReadableStreamDefaultController<Uint8Array>
  let resolveExit!: (code: number) => void

  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      stdoutController = controller
    },
  })
  const stderr = new ReadableStream<Uint8Array>()
  const stdin = {
    write(chunk: Uint8Array | string) {
      writes.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk))
      return Promise.resolve()
    },
    end() {},
  }
  const exited = new Promise<number>(resolve => {
    resolveExit = resolve
  })

  return {
    process: {
      stdin: stdin as unknown as TwitterDaemonProcess['stdin'],
      stdout,
      stderr,
      exited,
      kill() {},
    },
    writes,
    pushResponse(value: unknown) {
      stdoutController.enqueue(new TextEncoder().encode(`${JSON.stringify(value)}\n`))
    },
    finish(code = 0) {
      stdoutController.close()
      resolveExit(code)
    },
  }
}

describe('TwitterDaemonClient', () => {
  it('reuses one daemon process across requests', async () => {
    const fake = makeFakeProcess()
    let spawnCount = 0
    const client = new TwitterDaemonClient(() => {
      spawnCount += 1
      return fake.process
    })

    const first = client.request<{ value: number }>('ping', { n: 1 })
    await new Promise(resolve => setTimeout(resolve, 0))
    const firstReq = JSON.parse(fake.writes[0]!.trim())
    fake.pushResponse({ id: firstReq.id, ok: true, result: { value: 1 } })
    expect(await first).toEqual({ value: 1 })

    const second = client.request<{ value: number }>('pong', { n: 2 })
    await new Promise(resolve => setTimeout(resolve, 0))
    const secondReq = JSON.parse(fake.writes[1]!.trim())
    fake.pushResponse({ id: secondReq.id, ok: true, result: { value: 2 } })
    expect(await second).toEqual({ value: 2 })

    expect(spawnCount).toBe(1)
    fake.finish()
  })

  it('rejects pending requests when the daemon exits', async () => {
    const fake = makeFakeProcess()
    const client = new TwitterDaemonClient(() => fake.process)

    const pending = client.request('stuck', {})
    await new Promise(resolve => setTimeout(resolve, 0))
    fake.finish(1)
    try {
      await pending
      throw new Error('expected daemon request to reject')
    } catch (err) {
      expect((err as Error).message).toMatch(/exited/i)
    }
  })

  it('writes requests through Bun FileSink-style stdin', async () => {
    const fake = makeFileSinkProcess()
    const client = new TwitterDaemonClient(() => fake.process)

    const pending = client.request<{ value: number }>('ping', { n: 1 })
    await new Promise(resolve => setTimeout(resolve, 0))
    const req = JSON.parse(fake.writes[0]!.trim())
    fake.pushResponse({ id: req.id, ok: true, result: { value: 1 } })

    expect(await pending).toEqual({ value: 1 })
    fake.finish()
  })
})
