// Debug the regex pattern matching

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
  
  console.log('Testing different regex patterns:');
  
  const testPatterns = [
    /^GROQ_API_KEY(\d*)$/,
    /^GROQ_API_KEY(_\d+)?$/,
    /^GROQ_API_KEY\d*$/
  ];
  
  testPatterns.forEach((pattern, index) => {
    console.log(`\nPattern ${index + 1}: ${pattern}`);
    const matches = Object.keys(process.env).filter(key => pattern.test(key));
    console.log(`  Matches: ${matches.length}`);
    console.log(`  Keys: ${matches.join(', ')}`);
  });
  
  console.log(`\nActual keys in .env that look like GROQ keys:`);
  const groqLikeKeys = [];
  lines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key] = line.split('=');
      if (key && key.startsWith('GROQ_API_KEY')) {
        groqLikeKeys.push(key);
      }
    }
  });
  console.log(`Found ${groqLikeKeys.length} keys:`);
  groqLikeKeys.forEach(key => {
    console.log(`  ${key}`);
  });
} else {
  console.log('.env file not found');
}