import { readFileSync } from 'node:fs'

const path = process.argv[2] ?? '/tmp/x-tui-native-images.log'
const labelFilter = process.argv[3]

type Event = Record<string, unknown> & { event?: string; ts?: string; label?: string; instanceId?: string }

const events: Event[] = readFileSync(path, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(line => JSON.parse(line) as Event)
  .filter(event => !labelFilter || String(event.label ?? '').includes(labelFilter))

const counts = new Map<string, number>()
for (const event of events) counts.set(String(event.event), (counts.get(String(event.event)) ?? 0) + 1)
console.log('file', path)
console.log('events', events.length)
console.log('first', events[0]?.ts)
console.log('last', events.at(-1)?.ts)
console.log('counts', Object.fromEntries(counts))

const byInstance = new Map<string, Event[]>()
for (const event of events) {
  const key = String(event.instanceId ?? event.label ?? 'no-instance')
  const group = byInstance.get(key) ?? []
  group.push(event)
  byInstance.set(key, group)
}

const interesting = [...byInstance.entries()]
  .filter(([, group]) => group.some(event => event.event === 'draw'))
  .slice(-20)

for (const [instance, group] of interesting) {
  console.log('\nINSTANCE', instance)
  for (const event of group.slice(-16)) {
    const fields = [
      event.ts,
      event.event,
      event.label,
      `token=${event.drawToken ?? ''}`,
      `attempt=${event.attempt ?? ''}`,
      `row=${event.row ?? ''}`,
      `col=${event.col ?? ''}`,
      `ownCache=${event.ownCacheX ?? ''},${event.ownCacheY ?? ''},${event.ownCacheWidth ?? ''},${event.ownCacheHeight ?? ''}`,
      `ownYoga=${event.ownYogaLeft ?? ''},${event.ownYogaTop ?? ''},${event.ownYogaWidth ?? ''},${event.ownYogaHeight ?? ''}`,
      `chain=${event.parentChain ?? ''}`,
    ]
    console.log(fields.join(' | '))
  }
}
