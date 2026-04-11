import { PrismaClient } from '@prisma/client'

const OLD_DB = 'postgresql://neondb_owner:npg_TNKbiR7o4DtI@ep-long-sun-a1jztuq9.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
const NEW_DB = 'postgresql://neondb_owner:npg_hA3rSvbn8ica@ep-flat-art-anktlxod-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const oldPrisma = new PrismaClient({ datasources: { db: { url: OLD_DB } } })
const newPrisma = new PrismaClient({ datasources: { db: { url: NEW_DB } } })

async function main() {
  const oldCount = await oldPrisma.message.count()
  const newCount = await newPrisma.message.count()
  console.log(`Old: ${oldCount}, New: ${newCount}, Missing: ${oldCount - newCount}`)
  
  if (newCount < oldCount) {
    console.log('\nMigrating remaining messages...')
    const existing = await newPrisma.message.findMany({ select: { id: true } })
    const existingIds = new Set(existing.map(m => m.id))
    
    const allMessages = await oldPrisma.message.findMany()
    const toMigrate = allMessages.filter(m => !existingIds.has(m.id))
    console.log(`Found ${toMigrate} messages to migrate`)
    
    await newPrisma.message.createMany({ data: toMigrate, skipDuplicates: true })
    console.log('Done!')
    
    const finalCount = await newPrisma.message.count()
    console.log(`New count: ${finalCount}`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })