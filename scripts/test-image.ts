import { feed } from '../src/services/twitterCli.js'
import { getMediaBuffer } from '../src/services/mediaCache.js'
import { renderHalfblock } from '../src/utils/imageEncoders/halfblock.js'

const { tweets } = await feed({ max: 20 })
const withPhoto = tweets.find(t => t.media?.some(m => m.type === 'photo'))
if (!withPhoto) {
  console.log('No photo tweets in the first 20 — try again.')
  process.exit(1)
}
const url = withPhoto.media!.find(m => m.type === 'photo')!.url
console.log(`@${withPhoto.author.screenName}: ${withPhoto.text.slice(0, 60)}…`)
console.log(`Photo URL: ${url}\n`)

const buf = await getMediaBuffer(url)
console.log(`Downloaded ${buf.byteLength} bytes`)

const { lines, width, height } = await renderHalfblock(new Uint8Array(buf), { cols: 48, maxRows: 24 })
console.log(`Halfblock: ${width} cols × ${height} rows`)
for (const l of lines) console.log(l)
