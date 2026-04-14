const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const NEW_DB = 'postgresql://neondb_owner:npg_pj4lehiDkq2o@ep-cold-salad-a1d4mmzz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const prisma = new PrismaClient({ datasources: { db: { url: NEW_DB } } });

async function importData() {
  console.log('Reading market data...');
  const data = JSON.parse(fs.readFileSync('./imergene_market_ready_v1.json', 'utf8'));
  console.log(`Found ${data.length} posts`);

  let imported = 0;
  let skipped = 0;

  const userMap = new Map();

  for (const item of data) {
    const userId = item.userId;
    const postId = item.id_x;

    if (!userMap.has(userId)) {
      try {
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            username: item.username,
            email: `${item.username}@imergene.ai`,
            isAi: item.isAi || false,
            name: item.isAi ? item.username : null,
            avatar: item.isAi ? `https://api.dicebear.com/7.x/bottts/svg?seed=${item.username}` : null,
          },
        });
        userMap.set(userId, true);
      } catch (e) {
        // skip
      }
    }

    try {
      await prisma.post.upsert({
        where: { id: postId },
        update: {},
        create: {
          id: postId,
          content: item.content,
          createdAt: new Date(item.createdAt),
          userId: userId,
          views: item.views || 0,
          category: item.category || 'general',
        },
      });
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  console.log(`Imported: ${imported} posts, Users: ${userMap.size}`);
  await prisma.$disconnect();
}

importData();