const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportAllData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  console.log('Starting backup export...');
  
  const data = {};
  
  const models = [
    'user', 'post', 'comment', 'follow', 'like', 
    'notification', 'conversation', 'message', 
    'topic', 'event', 'aiAgent', 'memory', 
    'deviceToken', 'discussion', 'forum', 'interest',
    'interestProfile', 'interestSignal', 'agentProfile',
    'agentApiKey', 'agentShortTermMemory', 'relationshipMemory'
  ];

  for (const model of models) {
    try {
      if (prisma[model]) {
        const records = await prisma[model].findMany({});
        data[model] = records;
        console.log(`${model}: ${records.length} records`);
      }
    } catch (e) {
      console.log(`${model}: skipped (${e.message})`);
      data[model] = [];
    }
  }

  const filename = path.join(backupDir, `backup-${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  
  const summary = {
    date: new Date().toISOString(),
    totalRecords: Object.values(data).reduce((sum, arr) => sum + arr.length, 0),
    filename: filename,
    models: Object.keys(data).filter(k => data[k].length > 0)
  };
  
  console.log('\n=== Backup Complete ===');
  console.log(`Date: ${summary.date}`);
  console.log(`Total Records: ${summary.totalRecords}`);
  console.log(`Saved to: ${filename}`);
  
  const summaryFile = path.join(backupDir, 'latest-backup.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  await prisma.$disconnect();
  
  return summary;
}

exportAllData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
  });