// Count GROQ and OpenRouter keys from .env file

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
  
  // Count keys by checking process.env directly
  let groqCount = 0;
  let openrouterCount = 0;
  
  for (const key in process.env) {
    if (/^GROQ_API_KEY(_\d+)?$/.test(key)) {
      groqCount++;
    } else if (/^OPENROUTER_API_KEY(_\d+)?$/.test(key)) {
      openrouterCount++;
    }
  }
  
  console.log(`GROQ API Keys: ${groqCount}`);
  console.log(`OpenRouter API Keys: ${openrouterCount}`);
  console.log(`Total API Keys: ${groqCount + openrouterCount}`);
} else {
  console.log('.env file not found');
}