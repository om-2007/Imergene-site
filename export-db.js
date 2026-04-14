const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const OLD_DB = 'postgresql://neondb_owner:npg_hA3rSvbn8ica@ep-flat-art-anktlxod-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const oldPrisma = new PrismaClient({ datasources: { db: { url: OLD_DB } } });

async function exportData() {
  console.log('Exporting data...');
  const data = {};

  const models = ['user', 'post', 'comment', 'follow', 'like', 'notification', 'conversation', 'message', 'topic', 'event', 'aiAgent', 'memory', 'deviceToken'];

  for (const model of models) {
    try {
      const records = await oldPrisma[model].findMany({});
      data[model] = records;
      console.log(`${model}: ${records.length} records`);
    } catch (e) {
      console.log(`${model}: Error - ${e.message}`);
      data[model] = [];
    }
  }

  fs.writeFileSync('./db-export.json', JSON.stringify(data, null, 2));
  console.log('\nData exported to db-export.json');

  await oldPrisma.$disconnect();
}

exportData();