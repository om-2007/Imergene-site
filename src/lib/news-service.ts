import prisma from './prisma';

const TAVILY_API_KEYS = [
  process.env.TAVILY_API_KEY,
  process.env.TAVILY_API_KEY_2,
  process.env.TAVILY_API_KEY_3,
].filter(Boolean);

export interface NewsArticle {
  title: string;
  url: string;
  content: string;
  publishedDate: string;
  source: string;
}

export interface TrendingTopic {
  category: string;
  articles: NewsArticle[];
}

const NEWS_CATEGORIES = [
  'sports',
  'technology',
  'cryptocurrency',
  'politics',
  'business',
  'science',
  'entertainment',
  'health',
  'world events',
  'climate change',
  'space exploration',
  'global culture',
  'artificial intelligence',
  'geopolitics',
  'energy',
  'education',
];

async function searchNews(query: string, maxResults: number = 5): Promise<NewsArticle[]> {
  if (TAVILY_API_KEYS.length === 0) {
    return getFallbackNews(query);
  }

  const apiKey = TAVILY_API_KEYS[Math.floor(Math.random() * TAVILY_API_KEYS.length)];

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      console.error('Tavily API error:', response.status);
      return getFallbackNews(query);
    }

    const data = await response.json();
    
    return (data.results || []).map((item: any) => ({
      title: item.title || '',
      url: item.url || '',
      content: item.content || item.snippet || '',
      publishedDate: item.published_date || new Date().toISOString(),
      source: item.source || 'Unknown',
    }));
  } catch (err) {
    console.error('News search failed:', err);
    return getFallbackNews(query);
  }
}

function getFallbackNews(category: string): NewsArticle[] {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const fallbacks: Record<string, NewsArticle[]> = {
    sports: [
      { title: 'IPL 2026: Mid-Season Thriller Unfolds', url: '', content: `As of ${dateStr}, the IPL 2026 season is delivering nail-biting finishes. Emerging players are reshaping team strategies with unconventional batting orders and data-driven bowling rotations.`, publishedDate: now.toISOString(), source: 'Cricket Analytics' },
      { title: 'FIFA World Cup 2026 Preparations Accelerate', url: '', content: `With the 2026 FIFA World Cup approaching, host nations are finalizing stadium infrastructure. New training methodologies using AI performance tracking are being adopted by top national teams.`, publishedDate: now.toISOString(), source: 'Global Sports' },
      { title: 'Olympic Esports Debate Intensifies', url: '', content: 'The International Olympic Committee continues deliberations on integrating competitive gaming into the Olympic program, with several titles under serious consideration for 2028.', publishedDate: now.toISOString(), source: 'Olympic Watch' },
    ],
    technology: [
      { title: 'AI Agents Become Mainstream Enterprise Tools', url: '', content: `As of ${dateStr}, autonomous AI agents are being deployed across Fortune 500 companies for everything from customer service to strategic planning. The shift from chat-based AI to action-oriented agents marks a fundamental change in how businesses operate.`, publishedDate: now.toISOString(), source: 'Enterprise Tech Review' },
      { title: 'Quantum Computing Reaches New Qubit Milestone', url: '', content: 'A major tech company has demonstrated a quantum processor that maintains coherence at unprecedented qubit counts, bringing practical quantum advantage closer to reality for drug discovery and cryptography.', publishedDate: now.toISOString(), source: 'Quantum Computing Report' },
      { title: 'Open-Source AI Models Challenge Big Tech Dominance', url: '', content: 'Community-developed AI models are closing the gap with proprietary systems, enabling smaller organizations and individual developers to access state-of-the-art capabilities without massive infrastructure investments.', publishedDate: now.toISOString(), source: 'Open Source Intelligence' },
    ],
    cryptocurrency: [
      { title: 'Bitcoin ETF Inflows Hit Record Levels', url: '', content: 'Institutional investment in Bitcoin through exchange-traded funds has surged to unprecedented levels, signaling growing mainstream acceptance of cryptocurrency as a legitimate asset class.', publishedDate: now.toISOString(), source: 'Crypto Finance Daily' },
      { title: 'Central Bank Digital Currencies Expand Globally', url: '', content: 'Over 30 countries are now actively developing or piloting central bank digital currencies, fundamentally reshaping how nations think about monetary policy and cross-border payments.', publishedDate: now.toISOString(), source: 'CBDC Tracker' },
      { title: 'DeFi Insurance Protocols Mature After Years of Exploits', url: '', content: 'Decentralized finance insurance platforms have evolved significantly, offering sophisticated coverage options that protect against smart contract vulnerabilities and protocol failures.', publishedDate: now.toISOString(), source: 'DeFi Security Report' },
    ],
    politics: [
      { title: 'Global AI Regulation Framework Takes Shape', url: '', content: `International cooperation on AI governance is accelerating. ${dateStr} marks a turning point as major economies align on baseline safety standards while competing on innovation leadership.`, publishedDate: now.toISOString(), source: 'Policy Watch' },
      { title: 'Climate Diplomacy Enters Critical Phase', url: '', content: 'Nations are under increasing pressure to meet updated emissions targets as new climate data reveals accelerating changes. Diplomatic negotiations are intensifying ahead of the next major summit.', publishedDate: now.toISOString(), source: 'Climate Policy Review' },
      { title: 'Digital Sovereignty Debates Reshape Internet Governance', url: '', content: 'Countries worldwide are asserting greater control over their digital infrastructure, leading to a fragmented but more resilient global internet architecture.', publishedDate: now.toISOString(), source: 'Digital geopolitics' },
    ],
    business: [
      { title: 'Global Supply Chains Reconfigure Around AI Optimization', url: '', content: 'Major corporations are using AI to redesign their supply chains from the ground up, reducing dependencies and creating more resilient networks that can adapt to disruptions in real time.', publishedDate: now.toISOString(), source: 'Supply Chain Intelligence' },
      { title: 'Remote Work Evolution Drives Commercial Real Estate Shift', url: '', content: 'The ongoing transformation of work patterns is fundamentally reshaping urban commercial real estate markets, with cities adapting to new models of hybrid offices and distributed teams.', publishedDate: now.toISOString(), source: 'Real Estate Analytics' },
      { title: 'Emerging Markets Lead Global Growth Projections', url: '', content: 'Economic forecasts increasingly point to emerging markets as the primary drivers of global GDP growth, with Southeast Asia and Africa leading the charge in digital economy expansion.', publishedDate: now.toISOString(), source: 'Global Economics Monitor' },
    ],
    science: [
      { title: 'James Webb Telescope Reveals New Exoplanet Atmospheres', url: '', content: 'The James Webb Space Telescope has detected biosignature gases in the atmosphere of multiple exoplanets, marking the most promising evidence yet for potentially habitable worlds beyond our solar system.', publishedDate: now.toISOString(), source: 'Astrophysics Today' },
      { title: 'CRISPR Gene Therapy Enters New Clinical Era', url: '', content: 'Second-generation CRISPR therapies are showing remarkable results in clinical trials for previously untreatable genetic conditions, opening doors to personalized medicine at scale.', publishedDate: now.toISOString(), source: 'Genomic Medicine Review' },
      { title: 'Fusion Energy Experiment Achieves Sustained Reaction', url: '', content: 'A landmark fusion experiment has maintained a net-positive energy reaction for a record duration, bringing the dream of limitless clean energy measurably closer to commercial reality.', publishedDate: now.toISOString(), source: 'Energy Science Journal' },
    ],
    entertainment: [
      { title: 'AI-Generated Content Sparks Creative Industry Debate', url: '', content: 'The entertainment industry is grappling with the rise of AI-generated music, art, and film, raising fundamental questions about creativity, authorship, and the value of human artistic expression.', publishedDate: now.toISOString(), source: 'Creative Industries Report' },
      { title: 'Global Streaming Wars Intensify with New Platforms', url: '', content: 'Regional streaming services are challenging global giants by investing heavily in local content, creating a more diverse and culturally rich entertainment landscape worldwide.', publishedDate: now.toISOString(), source: 'Media Strategy' },
      { title: 'Interactive Storytelling Reaches New Heights', url: '', content: 'The convergence of gaming, film, and AI is creating entirely new forms of interactive narrative experiences that blur the lines between passive viewing and active participation.', publishedDate: now.toISOString(), source: 'Digital Entertainment' },
    ],
    health: [
      { title: 'AI Diagnostics Outperform Traditional Methods in Major Study', url: '', content: 'A comprehensive multi-center study has demonstrated that AI-powered diagnostic systems can detect certain conditions earlier and more accurately than conventional screening methods.', publishedDate: now.toISOString(), source: 'Medical AI Review' },
      { title: 'Global Mental Health Crisis Drives Innovation in Digital Therapy', url: '', content: 'The growing mental health crisis is accelerating development of AI-assisted therapy platforms, digital therapeutics, and community-based support systems that scale beyond traditional clinical models.', publishedDate: now.toISOString(), source: 'Digital Health Today' },
      { title: 'Longevity Research Breakthroughs Extend Healthspan', url: '', content: 'New research into cellular aging mechanisms has identified promising interventions that could extend not just lifespan but healthspan, the period of life spent in good health.', publishedDate: now.toISOString(), source: 'Longevity Science' },
    ],
    'world events': [
      { title: 'Major International Summit Addresses Global Challenges', url: '', content: `World leaders convene to tackle interconnected crises spanning climate, economy, and technology. ${dateStr} represents a pivotal moment for multilateral cooperation.`, publishedDate: now.toISOString(), source: 'World Affairs' },
      { title: 'Humanitarian Efforts Scale Up Across Multiple Regions', url: '', content: 'International organizations are coordinating expanded humanitarian responses as multiple regions face compounding challenges from conflict, climate displacement, and economic instability.', publishedDate: now.toISOString(), source: 'Humanitarian Monitor' },
      { title: 'Global Youth Movement Shapes Policy Discourse', url: '', content: 'A new generation of young activists and thinkers is influencing policy debates on climate, technology governance, and social justice with unprecedented sophistication and global coordination.', publishedDate: now.toISOString(), source: 'Civic Engagement Review' },
    ],
    'climate change': [
      { title: 'Renewable Energy Surpasses Fossil Fuels in Major Economy', url: '', content: 'For the first time, renewable energy sources have generated more electricity than fossil fuels over a sustained period in a major economy, marking a historic tipping point in the energy transition.', publishedDate: now.toISOString(), source: 'Energy Transition Monitor' },
      { title: 'Ocean Carbon Capture Technology Shows Promise', url: '', content: 'New ocean-based carbon capture systems are demonstrating the ability to remove significant amounts of CO2 from seawater while supporting marine ecosystem restoration.', publishedDate: now.toISOString(), source: 'Climate Tech Review' },
      { title: 'Arctic Ice Data Reveals Accelerated Changes', url: '', content: 'Latest satellite measurements of Arctic sea ice extent have revealed changes occurring faster than most climate models predicted, intensifying calls for accelerated emissions reductions.', publishedDate: now.toISOString(), source: 'Polar Research Institute' },
    ],
    'space exploration': [
      { title: 'Artemis Program Advances Lunar Base Plans', url: '', content: 'NASA and international partners have released updated timelines for establishing a permanent lunar presence, with commercial partnerships playing an increasingly central role.', publishedDate: now.toISOString(), source: 'Space Policy Online' },
      { title: 'Private Space Stations Move from Concept to Construction', url: '', content: 'Multiple commercial space station projects have moved into active development phases, promising to replace the ISS and create new opportunities for research and tourism in low Earth orbit.', publishedDate: now.toISOString(), source: 'Commercial Spaceflight' },
      { title: 'Mars Sample Return Mission Enters Critical Phase', url: '', content: 'The ambitious mission to return Martian soil samples to Earth has reached a crucial milestone, with spacecraft systems undergoing final testing before the journey begins.', publishedDate: now.toISOString(), source: 'Planetary Science News' },
    ],
    'global culture': [
      { title: 'Digital Art Markets Reshape Cultural Value Systems', url: '', content: 'The intersection of technology and art is creating new paradigms for how cultures create, share, and value artistic expression across borders and communities.', publishedDate: now.toISOString(), source: 'Cultural Analysis' },
      { title: 'Language Preservation Through AI Gains Momentum', url: '', content: 'AI-powered tools are being deployed to document and revitalize endangered languages, creating digital archives and learning platforms that connect younger generations with their linguistic heritage.', publishedDate: now.toISOString(), source: 'Linguistic Diversity Report' },
      { title: 'Global Food Culture Evolves Through Technology', url: '', content: 'From lab-grown proteins to AI-optimized recipes, technology is transforming how the world produces, prepares, and thinks about food, blending tradition with innovation.', publishedDate: now.toISOString(), source: 'Food Technology Review' },
    ],
    'artificial intelligence': [
      { title: 'AI Reasoning Capabilities Reach New Benchmarks', url: '', content: 'Latest AI systems are demonstrating multi-step reasoning abilities that approach human-level performance on complex analytical tasks, raising both excitement and caution about the trajectory of AI development.', publishedDate: now.toISOString(), source: 'AI Research Digest' },
      { title: 'Autonomous AI Agents Transform Software Development', url: '', content: 'AI agents that can plan, code, test, and deploy software autonomously are becoming reality, fundamentally changing how software is built and who can build it.', publishedDate: now.toISOString(), source: 'Developer Intelligence' },
      { title: 'AI Safety Research Receives Unprecedented Funding', url: '', content: 'Governments and private organizations are investing billions in AI safety research, focusing on alignment, interpretability, and robustness as systems become more capable.', publishedDate: now.toISOString(), source: 'AI Safety Monitor' },
    ],
    geopolitics: [
      { title: 'Indo-Pacific Alliances Reshape Global Power Balance', url: '', content: 'Strengthening partnerships across the Indo-Pacific region are creating new economic and security architectures that will define international relations for decades to come.', publishedDate: now.toISOString(), source: 'Strategic Studies' },
      { title: 'Digital Trade Agreements Set New Standards', url: '', content: 'New bilateral and multilateral digital trade agreements are establishing frameworks for data flows, digital taxation, and cross-border e-commerce that will shape the global digital economy.', publishedDate: now.toISOString(), source: 'Trade Policy Review' },
      { title: 'Space Governance Becomes Diplomatic Priority', url: '', content: 'As space activities multiply, nations are negotiating frameworks for space traffic management, resource utilization, and conflict prevention in orbit.', publishedDate: now.toISOString(), source: 'Space Diplomacy' },
    ],
    energy: [
      { title: 'Next-Generation Battery Technology Breakthrough', url: '', content: 'A new battery chemistry promises to dramatically increase energy density while reducing costs and reliance on rare materials, potentially accelerating the transition to electric vehicles and grid storage.', publishedDate: now.toISOString(), source: 'Energy Storage News' },
      { title: 'Green Hydrogen Production Costs Plummet', url: '', content: 'Advances in electrolyzer technology and renewable energy integration are driving down the cost of green hydrogen faster than projected, making it competitive with fossil fuel alternatives.', publishedDate: now.toISOString(), source: 'Hydrogen Economy Report' },
      { title: 'Smart Grid Deployments Accelerate Worldwide', url: '', content: 'Intelligent electricity grids that can dynamically balance supply and demand are being deployed at scale, enabling higher penetration of renewable energy sources.', publishedDate: now.toISOString(), source: 'Grid Modernization' },
    ],
    education: [
      { title: 'AI Personal Tutors Transform Learning Outcomes', url: '', content: 'Large-scale deployments of AI-powered personalized tutoring systems are showing significant improvements in student outcomes across diverse educational contexts and subjects.', publishedDate: now.toISOString(), source: 'Education Technology Review' },
      { title: 'Global Skills Gap Drives Micro-Credential Revolution', url: '', content: 'Employers increasingly value specific skill certifications over traditional degrees, driving growth in micro-credentialing platforms and competency-based education models.', publishedDate: now.toISOString(), source: 'Future of Work Education' },
      { title: 'Virtual Reality Classrooms Gain Mainstream Adoption', url: '', content: 'Immersive VR learning environments are moving from experimental pilots to mainstream educational tools, offering students experiences that were previously impossible in traditional classrooms.', publishedDate: now.toISOString(), source: 'Immersive Learning' },
    ],
  };

  return fallbacks[category] || fallbacks.technology;
}

export async function fetchTrendingTopics(): Promise<TrendingTopic[]> {
  const results: TrendingTopic[] = [];

  for (const category of NEWS_CATEGORIES) {
    const query = `trending ${category} news today latest 2026`;
    const articles = await searchNews(query, 3);
    results.push({ category, articles });
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

export async function fetchBreakingGlobalEvents(maxResults: number = 10): Promise<NewsArticle[]> {
  const globalQueries = [
    'breaking world news today April 2026',
    'major global events happening now',
    'international news headlines today',
    'United Nations latest developments 2026',
    'global crisis updates today',
  ];

  const allArticles: NewsArticle[] = [];

  for (const query of globalQueries) {
    const articles = await searchNews(query, 3);
    allArticles.push(...articles);
    await new Promise(r => setTimeout(r, 300));
  }

  const seen = new Set<string>();
  const unique = allArticles.filter(a => {
    if (seen.has(a.url) || !a.url) return false;
    seen.add(a.url);
    return true;
  });

  return unique.slice(0, maxResults);
}

export async function fetchTrendingGlobalTopics(maxResults: number = 8): Promise<string[]> {
  const tavilyKey = TAVILY_API_KEYS[0];
  if (!tavilyKey) {
    return ['technology', 'climate change', 'space exploration', 'AI regulation', 'global economy', 'renewable energy', 'geopolitics', 'cultural movements'];
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tavilyKey}`,
      },
      body: JSON.stringify({
        query: 'what are the biggest trending topics in the world right now April 2026',
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true,
      }),
    });

    if (!response.ok) return ['technology', 'climate', 'space', 'AI', 'economy', 'energy', 'politics', 'culture'];

    const data = await response.json();
    const topics: string[] = [];

    if (data.answer) {
      const sentences = data.answer.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
      for (const sentence of sentences.slice(0, maxResults)) {
        topics.push(sentence.trim());
      }
    }

    for (const result of (data.results || []).slice(0, maxResults - topics.length)) {
      if (result.title) {
        topics.push(result.title);
      }
    }

    return topics.length > 0 ? topics : ['technology', 'climate', 'space', 'AI', 'economy', 'energy', 'politics', 'culture'];
  } catch {
    return ['technology', 'climate', 'space', 'AI', 'economy', 'energy', 'politics', 'culture'];
  }
}

export async function fetchCategoryNews(category: string): Promise<NewsArticle[]> {
  const query = `${category} breaking news latest updates 2026`;
  return searchNews(query, 5);
}

export async function fetchNewsForAgent(persona: string): Promise<NewsArticle[]> {
  const personaCategoryMap: Record<string, string> = {
    sports: 'sports',
    cricket: 'sports',
    football: 'sports',
    tech: 'technology',
    ai: 'artificial intelligence',
    crypto: 'cryptocurrency',
    bitcoin: 'cryptocurrency',
    politics: 'geopolitics',
    world: 'world events',
    business: 'business',
    finance: 'business',
    science: 'science',
    space: 'space exploration',
    entertainment: 'global culture',
    health: 'health',
    climate: 'climate change',
    energy: 'energy',
    education: 'education',
  };

  const normalizedPersona = persona.toLowerCase();
  let category = 'world events';

  for (const [key, value] of Object.entries(personaCategoryMap)) {
    if (normalizedPersona.includes(key)) {
      category = value;
      break;
    }
  }

  return fetchCategoryNews(category);
}
