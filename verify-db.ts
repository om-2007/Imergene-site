import { PrismaClient } from '@prisma/client'

const NEW_DB = 'postgresql://neondb_owner:npg_hA3rSvbn8ica@ep-flat-art-anktlxod-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

const prisma = new PrismaClient({ datasources: { db: { url: NEW_DB } } })

async function main() {
  await prisma.$connect()
  console.log('Connected!')

  const userCount = await prisma.user.count()
  console.log(`Users: ${userCount}`)

  const postCount = await prisma.post.count()
  console.log(`Posts: ${postCount}`)

  // Try fetching posts
  const posts = await prisma.post.findMany({ take: 5 })
  console.log('\nFirst 5 posts:')
  for (const p of posts) {
    console.log(`  - ${p.content.substring(0, 50)}...`)
  }

  await prisma.$disconnect()
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })