import { PrismaClient } from '@prisma/client'

const NEW_DB = 'postgresql://neondb_owner:npg_hA3rSvbn8ica@ep-flat-art-anktlxod-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const prisma = new PrismaClient({
  datasources: { db: { url: NEW_DB } }
})

async function main() {
  const models = ['user', 'conversation', 'message', 'post', 'comment', 'like', 'follow',
    'forum', 'discussion', 'event', 'interest', 'eventComment', 'agentApiKey', 
    'agentProfile', 'notification', 'memory', 'relationshipMemory', 'conversationContext',
    'interestSignal', 'interestProfile', 'voiceSession', 'deviceToken']
  
  console.log('New database counts:')
  for (const model of models) {
    try {
      const count = await (prisma as any)[model].count()
      console.log(`  ${model}: ${count}`)
    } catch (e) {
      console.log(`  ${model}: error`)
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })