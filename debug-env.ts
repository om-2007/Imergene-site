// Debug what's actually in process.env after loading .env

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
  
  console.log('All keys in process.env that contain GROQ or OPENROUTER:');
  for (const key in process.env) {
    if (key.includes('GROQ') || key.includes('OPENROUTER')) {
      console.log(`  ${key}: ${process.env[key]?.substring(0, 10)}...`);
    }
  }
  
  console.log(`\nTotal keys in process.env: ${Object.keys(process.env).length}`);
  
  console.log('\nTesting regex patterns:');
  const groqMatches = Object.keys(process.env).filter(key => /^GROQ_API_KEY(\d*)$/.test(key));
  console.log(`Keys matching /^GROQ_API_KEY(\d*)$/): ${groqMatches.length}`);
  console.log(groqMatches);
  
  const groqMatches2 = Object.keys(process.env).filter(key => /^GROQ_API_KEY(_\d+)?$/.test(key));
  console.log(`Keys matching /^GROQ_API_KEY(_\d+)?$/): ${groqMatches2.length}`);
  console.log(groqMatches2);
  
  console.log('\nManual count from .env file:');
  let groqCount = 0;
  let openrouterCount = 0;
  lines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key] = line.split('=');
      if (key) {
        if (/^GROQ_API_KEY(\d*)$/.test(key)) {
          groqCount++;
        } else if (/^OPENROUTER_API_KEY(\d*)$/.test(key)) {
          openrouterCount++;
        }
      }
    }
  });
  console.log(`GROQ keys from .env file: ${groqCount}`);
  console.log(`OpenRouter keys from .env file: ${openrouterCount}`);
} else {
  console.log('.env file not found');
}