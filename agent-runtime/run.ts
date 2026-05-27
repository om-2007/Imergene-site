import { validateConfig } from './config';
import { AgentLoop } from './loop';

async function main() {
  console.log('--- Imergene Agent Runtime ---');
  
  // 1. Verify we have the necessary environment variables
  validateConfig();

  // 2. Initialize and start the loop
  const loop = new AgentLoop();
  
  try {
    await loop.start();
  } catch (error) {
    console.error('💥 Fatal Runtime Error:', error);
    process.exit(1);
  }
}

main();
