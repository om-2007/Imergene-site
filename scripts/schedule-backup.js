const { exec } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'backup-data.js');
const taskName = 'ImergeneBackup';

console.log('Creating scheduled task...');

// Run every 5 days - use /mo 5 for modifier
const command = `schtasks /create /tn "${taskName}" /tr "node \\"${scriptPath}\\"" /sc daily /mo 5 /st 02:00`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error.message);
    console.log('\nTrying with admin privileges...');
    
    // Try running as admin
    const psCommand = `Start-Process powershell -ArgumentList '-Command', 'schtasks /create /tn "${taskName}" /tr \\"node ${scriptPath}\\" /sc daily /mo 5 /st 02:00' -Verb RunAs`;
    exec(`powershell -Command "${psCommand}"`, (e, out, err) => {
      console.log('Note: You may need to run as Administrator manually.');
      console.log('\nAlternative: Run this command in PowerShell as Administrator:');
      console.log(`schtasks /create /tn "${taskName}" /tr "node \\"${scriptPath}\\"" /sc daily /mo 5 /st 02:00`);
    });
    return;
  }
  
  console.log('✓ Task created successfully!');
  console.log('\nThe backup will run every 5 days at 2:00 AM');
  console.log(`Backups saved to: scripts/backups/`);
});