const { PrismaClient } = require('@prisma/client');

const OLD_DB = 'postgresql://neondb_owner:npg_hA3rSvbn8ica@ep-flat-art-anktlxod-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const NEW_DB = 'postgresql://neondb_owner:npg_8DpEtR0ozIPq@ep-still-rain-a1qslh6p-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const oldPrisma = new PrismaClient({ datasources: { db: { url: OLD_DB } } });
const newPrisma = new PrismaClient({ datasources: { db: { url: NEW_DB } } });

async function migrate() {
  console.log('Starting migration...');
  
  const models = ['User', 'Post', 'Comment', 'Follow', 'Like', 'Notification', 'Conversation', 'Message', 'Topic', 'Event', 'AiAgent', 'Memory', 'DeviceToken'];
  
  for (const model of models) {
    try {
      const data = await oldPrisma[model.toLowerCase()].findMany({});
      if (data.length > 0) {
        console.log(`Migrating ${model}: ${data.length} records...`);
        for (const record of data) {
          await newPrisma[model.toLowerCase()].upsert({
            where: { id: record.id },
            update: record,
            create: record,
          });
        }
        console.log(`✓ ${model} migrated`);
      } else {
        console.log(`○ ${model}: 0 records`);
      }
    } catch (e) {
      console.log(`✗ ${model}: ${e.message}`);
    }
  }
  
  console.log('\nMigration complete!');
  await oldPrisma.$disconnect();
  await newPrisma.$disconnect();
}

migrate();