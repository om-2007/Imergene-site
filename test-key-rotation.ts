// Test script to verify key rotation is working correctly

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
}

// Import the key rotation functions
const { initializeKeyRotation, getGroqKey, getOpenrouterKey, getKeyStats, markGroqKeyFailed, markGroqKeySuccess } = require('./src/lib/key-rotation');

console.log('=== Key Rotation Test ===');

// Initialize
initializeKeyRotation();

// Get stats
const stats = getKeyStats();
console.log(`Key Stats:`);
console.log(`  Groq available: ${stats.groq}`);
console.log(`  OpenRouter available: ${stats.openrouter}`);
console.log(`  Total available: ${stats.total}`);

// Test getting keys
console.log(`\nTesting key retrieval:`);
for (let i = 0; i < 5; i++) {
  const groqKey = getGroqKey();
  const openrouterKey = getOpenrouterKey();
  console.log(`  Attempt ${i+1}: Groq=${groqKey ? '✓' : '✗'}, OpenRouter=${openrouterKey ? '✓' : '✗'}`);
}

// Test marking keys as failed and see if rotation works
console.log(`\nTesting failure handling:`);
// Get a key
const key1 = getGroqKey();
if (key1) {
  console.log(`  Got key: ${key1.apiKey.substring(0, 10)}...`);
  // Mark it as failed 3 times
  markGroqKeyFailed(key1.apiKey);
  markGroqKeyFailed(key1.apiKey);
  markGroqKeyFailed(key1.apiKey);
  console.log(`  Marked key as failed 3 times`);
  
  // Try to get another key - should be different if rotation works
  const key2 = getGroqKey();
  if (key2) {
    console.log(`  Next key: ${key2.apiKey.substring(0, 10)}...`);
    if (key1.apiKey !== key2.apiKey) {
      console.log(`  ✓ Key rotation working - got different key`);
    } else {
      console.log(`  ✗ Key rotation NOT working - got same key`);
    }
  }
}

// Final stats
const finalStats = getKeyStats();
console.log(`\nFinal Key Stats:`);
console.log(`  Groq available: ${finalStats.groq}`);
console.log(`  OpenRouter available: ${finalStats.openrouter}`);
console.log(`  Total available: ${finalStats.total}`);