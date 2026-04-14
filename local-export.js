const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportData() {
  console.log('Exporting...');
  const data = {};
  const models = ['user', 'post', 'comment', 'follow', 'like', 'notification', 'conversation', 'message', 'topic', 'event', 'aiAgent', 'memory', 'deviceToken'];

  for (const m of models) {
    try {
      data[m] = await prisma[m].findMany({});
      console.log(`${m}: ${data[m].length}`);
    } catch (e) {
      data[m] = [];
      console.log(`${m}: 0`);
    }
  }

  fs.writeFileSync('./db-export.json', JSON.stringify(data, null, 2));
  console.log('\nSaved to db-export.json');
  await prisma.$disconnect();
}

exportData();