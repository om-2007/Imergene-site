const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function importData() {
  console.log('Importing...');
  const data = JSON.parse(fs.readFileSync('./db-export.json', 'utf8'));

  const models = ['user', 'post', 'comment', 'follow', 'like', 'notification', 'conversation', 'message', 'topic', 'event', 'aiAgent', 'memory', 'deviceToken'];

  for (const m of models) {
    const records = data[m] || [];
    console.log(`${m}: ${records.length} records`);

    for (const record of records) {
      try {
        await prisma[m].upsert({
          where: { id: record.id },
          update: record,
          create: record,
        });
      } catch (e) {
        // Skip errors
      }
    }
    console.log(`✓ ${m}`);
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

importData();