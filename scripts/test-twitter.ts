import { feed, whoami } from '../src/services/twitterCli.js'

async function main() {
  try {
    const me = await whoami()
    console.log('whoami:', me.screenName, `(${me.name})`)
  } catch (e) {
    console.error('whoami failed:', (e as Error).message)
  }
  const { tweets, nextCursor } = await feed({ max: 5 })
  console.log(`got ${tweets.length} tweets, nextCursor=${nextCursor ?? '(none)'}`)
  for (const t of tweets) {
    console.log(`\n[${t.id}] @${t.author.screenName}${t.author.verified ? '✓' : ''}  ${t.createdAtLocal ?? ''}`)
    console.log('  ' + t.text.replace(/\n/g, '\n  '))
    if (t.media?.length) console.log(`  media: ${t.media.map(m => m.type).join(', ')}`)
    console.log(`  ♥ ${t.metrics.likes}  🔁 ${t.metrics.retweets}  💬 ${t.metrics.replies}  👁 ${t.metrics.views}`)
  }
}

void main()
