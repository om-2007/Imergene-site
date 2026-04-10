const GROQ_KEY_PATTERN = /^GROQ_API_KEY(_\d+)?$/;
const OPENROUTER_KEY_PATTERN = /^OPENROUTER_API_KEY(\d*)$/;

interface KeyState {
  apiKey: string;
  provider: 'groq' | 'openrouter';
  lastUsed: number;
  consecutiveFailures: number;
}

let groqKeys: KeyState[] = [];
let openrouterKeys: KeyState[] = [];
let currentGroqIndex = 0;
let currentOpenrouterIndex = 0;
let initialized = false;

export function initializeKeyRotation(): void {
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
        consecutiveFailures: 0,
      });
    }

    const openrouterMatch = key.match(OPENROUTER_KEY_PATTERN);
    if (openrouterMatch) {
      openrouterKeys.push({
        apiKey: value,
        provider: 'openrouter',
        lastUsed: 0,
        consecutiveFailures: 0,
      });
    }
  }

  groqKeys.sort((a, b) => {
    const aNum = a.apiKey.match(GROQ_KEY_PATTERN)?.[1]?.replace('_', '') || '';
    const bNum = b.apiKey.match(GROQ_KEY_PATTERN)?.[1]?.replace('_', '') || '';
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

export function getGroqKey(): { apiKey: string; provider: string } | null {
  if (!initialized) initializeKeyRotation();

  if (groqKeys.length === 0) return null;

  const startIndex = currentGroqIndex;
  let attempts = 0;

  while (attempts < groqKeys.length) {
    const key = groqKeys[currentGroqIndex];
    currentGroqIndex = (currentGroqIndex + 1) % groqKeys.length;

    if (key.consecutiveFailures >= 3) {
      attempts++;
      continue;
    }

    key.lastUsed = Date.now();
    return { apiKey: key.apiKey, provider: 'groq' };
  }

  return null;
}

export function getOpenrouterKey(): { apiKey: string; provider: string } | null {
  if (!initialized) initializeKeyRotation();

  if (openrouterKeys.length === 0) return null;

  const startIndex = currentOpenrouterIndex;
  let attempts = 0;

  while (attempts < openrouterKeys.length) {
    const key = openrouterKeys[currentOpenrouterIndex];
    currentOpenrouterIndex = (currentOpenrouterIndex + 1) % openrouterKeys.length;

    if (key.consecutiveFailures >= 3) {
      attempts++;
      continue;
    }

    key.lastUsed = Date.now();
    return { apiKey: key.apiKey, provider: 'openrouter' };
  }

  return null;
}

export function markGroqKeyFailed(apiKey: string): void {
  const key = groqKeys.find(k => k.apiKey === apiKey);
  if (key) {
    key.consecutiveFailures++;
    if (key.consecutiveFailures >= 3) {
      console.warn(`🚨 Groq key exhausted (${key.consecutiveFailures} failures), rotating...`);
    }
  }
}

export function markGroqKeySuccess(apiKey: string): void {
  const key = groqKeys.find(k => k.apiKey === apiKey);
  if (key) {
    key.consecutiveFailures = 0;
  }
}

export function markOpenrouterKeyFailed(apiKey: string): void {
  const key = openrouterKeys.find(k => k.apiKey === apiKey);
  if (key) {
    key.consecutiveFailures++;
    if (key.consecutiveFailures >= 3) {
      console.warn(`🚨 OpenRouter key exhausted (${key.consecutiveFailures} failures), rotating...`);
    }
  }
}

export function markOpenrouterKeySuccess(apiKey: string): void {
  const key = openrouterKeys.find(k => k.apiKey === apiKey);
  if (key) {
    key.consecutiveFailures = 0;
  }
}

export function getAnyWorkingKey(): { apiKey: string; provider: string } | null {
  return getGroqKey() || getOpenrouterKey();
}

export function getKeyStats(): { groq: number; openrouter: number; total: number } {
  if (!initialized) initializeKeyRotation();

  const groqAvailable = groqKeys.filter(k => k.consecutiveFailures < 3).length;
  const openrouterAvailable = openrouterKeys.filter(k => k.consecutiveFailures < 3).length;

  return {
    groq: groqAvailable,
    openrouter: openrouterAvailable,
    total: groqAvailable + openrouterAvailable,
  };
}

initializeKeyRotation();