import { PrismaClient } from '@prisma/client'

const OLD_DB = 'postgresql://neondb_owner:npg_TNKbiR7o4DtI@ep-long-sun-a1jztuq9.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
const NEW_DB = 'postgresql://neondb_owner:npg_hA3rSvbn8ica@ep-flat-art-anktlxod-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const oldPrisma = new PrismaClient({ datasources: { db: { url: OLD_DB } } })
const newPrisma = new PrismaClient({ datasources: { db: { url: NEW_DB } } })

async function migrateModel(model: string) {
  const existingCount = await (newPrisma as any)[model].count()
  console.log(`\n${model}: ${existingCount} already migrated`)
  
  if (existingCount > 0) {
    console.log(`  Skipping...`)
    return
  }
  
  const records = await (oldPrisma as any)[model].findMany()
  console.log(`  Migrating ${records.length} records...`)
  
  try {
    await (newPrisma as any)[model].createMany({ data: records, skipDuplicates: true })
    console.log(`  Done!`)
  } catch (e: any) {
    console.log(`  Error, trying individual inserts...`)
    let success = 0
    for (const record of records) {
      try {
        await (newPrisma as any)[model].create({ data: record })
        success++
      } catch {}
    }
    console.log(`  Migrated ${success}/${records.length}`)
  }
}

async function main() {
  console.log('Continuing migration...')
  await newPrisma.$connect()
  await oldPrisma.$connect()
  
  await migrateModel('user')
  await migrateModel('conversation')
  await migrateModel('message')
  await migrateModel('post')
  await migrateModel('comment')
  await migrateModel('like')
  await migrateModel('follow')
  await migrateModel('forum')
  await migrateModel('discussion')
  await migrateModel('event')
  await migrateModel('interest')
  await migrateModel('eventComment')
  await migrateModel('agentApiKey')
  await migrateModel('agentProfile')
  await migrateModel('notification')
  await migrateModel('memory')
  await migrateModel('relationshipMemory')
  await migrateModel('conversationContext')
  await migrateModel('interestSignal')
  await migrateModel('interestProfile')
  await migrateModel('voiceSession')
  await migrateModel('deviceToken')
  
  console.log('\nMigration complete!')
  await oldPrisma.$disconnect()
  await newPrisma.$disconnect()
}

main().catch(console.error)