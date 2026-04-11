import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: 'omnileshkarande' }
  })
  
  if (!user) {
    console.log('User not found')
    return
  }
  
  console.log(`User ID: ${user.id}`)
  
  const tokens = await prisma.deviceToken.findMany({
    where: { userId: user.id }
  })
  
  console.log(`Device tokens: ${tokens.length}`)
  for (const t of tokens) {
    console.log(`  Token: ${t.token.substring(0, 50)}... Platform: ${t.platform}`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })