// Check how many API keys have exhausted their limits (consecutive failures >= 3)

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

// Simulate the key rotation logic from key-rotation.ts
const GROQ_KEY_PATTERN = /^GROQ_API_KEY(\d*)$/;
const OPENROUTER_KEY_PATTERN = /^OPENROUTER_API_KEY(\d*)$/;

interface KeyState {
  apiKey: string;
  provider: 'groq' | 'openrouter';
  lastUsed: number;
  consecutiveFailures: number;
}

let groqKeys: KeyState[] = [];
let openrouterKeys: KeyState[] = [];
let initialized = false;

function initializeKeyRotation(): void {
  if (initialized) return;

  groqKeys = [];
  openrouterKeys = [];

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;

    const groqMatch = key.match(GROQ_KEY_PATTERN);
    if (groqMatch) {
      groqKeys.push({
        apiKey: value,
        provider: 'groq',
        lastUsed: 0,
        consecutiveFailures: 0, // Initialize with 0 failures
      });
    }

    const openrouterMatch = key.match(OPENROUTER_KEY_PATTERN);
    if (openrouterMatch) {
      openrouterKeys.push({
        apiKey: value,
        provider: 'openrouter',
        lastUsed: 0,
        consecutiveFailures: 0, // Initialize with 0 failures
      });
    }
  }

  groqKeys.sort((a, b) => {
    const aNum = a.apiKey.match(GROQ_KEY_PATTERN)?.[1] || '';
    const bNum = b.apiKey.match(GROQ_KEY_PATTERN)?.[1] || '';
    return (parseInt(aNum) || 0) - (parseInt(bNum) || 0);
  });

  openrouterKeys.sort((a, b) => {
    const aNum = a.apiKey.match(OPENROUTER_KEY_PATTERN)?.[1] || '';
    const bNum = b.apiKey.match(OPENROUTER_KEY_PATTERN)?.[1] || '';
    return (parseInt(aNum) || 0) - (parseInt(bNum) || 0);
  });

  initialized = true;
  console.log(`🔑 Key Rotation initialized: ${groqKeys.length} Groq keys, ${openrouterKeys.length} OpenRouter keys`);
}

// Get current key statistics
function getKeyStats(): { 
  groq: number; 
  openrouter: number; 
  total: number;
  groqExhausted: number;
  openrouterExhausted: number;
  totalExhausted: number;
} {
  if (!initialized) initializeKeyRotation();

  const groqAvailable = groqKeys.filter(k => k.consecutiveFailures < 3).length;
  const openrouterAvailable = openrouterKeys.filter(k => k.consecutiveFailures < 3).length;
  
  const groqExhausted = groqKeys.filter(k => k.consecutiveFailures >= 3).length;
  const openrouterExhausted = openrouterKeys.filter(k => k.consecutiveFailures >= 3).length;

  return {
    groq: groqAvailable,
    openrouter: openrouterAvailable,
    total: groqAvailable + openrouterAvailable,
    groqExhausted: groqExhausted,
    openrouterExhausted: openrouterExhausted,
    totalExhausted: groqExhausted + openrouterExhausted
  };
}

// Initialize the key rotation system
initializeKeyRotation();

// Get current key statistics
const stats = getKeyStats();

// Get total configured keys
const groqKeyCount = Object.keys(process.env).filter(key => /^GROQ_API_KEY(\d*)$/.test(key)).length;
const openrouterKeyCount = Object.keys(process.env).filter(key => /^OPENROUTER_API_KEY(\d*)$/.test(key)).length;

console.log(`Key Exhaustion Report:`);
console.log(`=====================`);
console.log(`Groq Keys:`);
console.log(`  Total configured: ${groqKeyCount}`);
console.log(`  Currently available (failures < 3): ${stats.groq}`);
console.log(`  Exhausted (failures >= 3): ${stats.groqExhausted}`);
console.log(``);
console.log(`OpenRouter Keys:`);
console.log(`  Total configured: ${openrouterKeyCount}`);
console.log(`  Currently available (failures < 3): ${stats.openrouter}`);
console.log(`  Exhausted (failures >= 3): ${stats.openrouterExhausted}`);
console.log(``);
console.log(`Summary:`);
console.log(`  Total keys configured: ${groqKeyCount + openrouterKeyCount}`);
console.log(`  Total available: ${stats.total}`);
console.log(`  Total exhausted: ${stats.totalExhausted}`);

// Show details of exhausted keys if any
if (stats.totalExhausted > 0) {
  console.log(`\nExhausted Keys Details:`);
  console.log(`=====================`);
  
  const exhaustedGroqKeys = groqKeys.filter(k => k.consecutiveFailures >= 3);
  if (exhaustedGroqKeys.length > 0) {
    console.log(`Groq Keys Exhausted:`);
    exhaustedGroqKeys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${key.apiKey.substring(0, 10)}... (${key.consecutiveFailures} failures)`);
    });
  }
  
  const exhaustedOpenrouterKeys = openrouterKeys.filter(k => k.consecutiveFailures >= 3);
  if (exhaustedOpenrouterKeys.length > 0) {
    console.log(`OpenRouter Keys Exhausted:`);
    exhaustedOpenrouterKeys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${key.apiKey.substring(0, 10)}... (${key.consecutiveFailures} failures)`);
    });
  }
} else {
  console.log(`\nNo keys have exhausted their limits (all have < 3 consecutive failures)`);
}