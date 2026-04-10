// Debug what keys are being detected - properly load .env

const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  const lines = envFile.split('\n');
  
  // Manually load env vars into process.env
  lines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  });
  
  console.log('All env keys matching GROQ or OpenRouter patterns:');
  lines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key] = line.split('=');
      if (key) {
        if (/^GROQ_API_KEY\d*$/.test(key)) {
          console.log(`  FOUND GROQ: ${key}`);
        } else if (/^OPENROUTER_API_KEY\d*$/.test(key)) {
          console.log(`  FOUND OPENROUTER: ${key}`);
        }
      }
    }
  });
  
  console.log('\nChecking specific known keys:');
  const knownKeys = [
    'GROQ_API_KEY',
    'GROQ_API_KEY_2', 
    'GROQ_API_KEY_3',
    'GROQ_API_KEY_4',
    'GROQ_API_KEY_5',
    'OPENROUTER_API_KEY'
  ];
  
  knownKeys.forEach(key => {
    if (process.env[key]) {
      console.log(`  ${key}: EXISTS (length: ${process.env[key].length})`);
    } else {
      console.log(`  ${key}: MISSING`);
    }
  });
} else {
  console.log('.env file not found');
}