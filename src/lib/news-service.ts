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
  const fallbacks: Record<string, NewsArticle[]> = {
    sports: [
      { title: 'IPL 2026: Exciting Matches Continue', url: '', content: 'The Indian Premier League 2026 season continues with thrilling matches and outstanding performances from players across teams.', publishedDate: new Date().toISOString(), source: 'Cricket News' },
      { title: 'Global Cricket League Announced', url: '', content: 'A new international cricket league has been announced, bringing together players from various nations for an exciting tournament format.', publishedDate: new Date().toISOString(), source: 'Sports Desk' },
      { title: 'Rohit Sharma Leads Team to Victory', url: '', content: 'In a stunning display of leadership and skill, Rohit Sharma guided his team to a crucial victory in the ongoing tournament.', publishedDate: new Date().toISOString(), source: 'Cricket Weekly' },
    ],
    technology: [
      { title: 'AI Breakthrough Announced', url: '', content: 'Researchers have announced a significant breakthrough in artificial intelligence that promises to revolutionize how we interact with technology.', publishedDate: new Date().toISOString(), source: 'Tech Daily' },
      { title: 'New Smartphone Features Revealed', url: '', content: 'The latest smartphone generation introduces groundbreaking features including enhanced AI capabilities and improved battery life.', publishedDate: new Date().toISOString(), source: 'Gadget Review' },
      { title: 'Cloud Computing Trends for 2026', url: '', content: 'Experts predict major shifts in cloud computing infrastructure as businesses increasingly migrate to hybrid solutions.', publishedDate: new Date().toISOString(), source: 'Tech Insights' },
    ],
    cryptocurrency: [
      { title: 'Bitcoin Shows Strong Recovery', url: '', content: 'Bitcoin has shown remarkable recovery in recent trading sessions, with analysts pointing to increased institutional interest.', publishedDate: new Date().toISOString(), source: 'Crypto Weekly' },
      { title: 'New Blockchain Project Launches', url: '', content: 'A new blockchain project has launched with the aim of solving scalability issues faced by existing networks.', publishedDate: new Date().toISOString(), source: 'Blockchain News' },
      { title: 'DeFi Platform Reaches New Milestone', url: '', content: 'Decentralized finance continues to grow as a leading DeFi platform announces reaching $10 billion in total value locked.', publishedDate: new Date().toISOString(), source: 'DeFi Daily' },
    ],
    politics: [
      { title: 'Global Summit Addresses Climate Change', url: '', content: 'World leaders gather at a global summit to discuss urgent measures needed to combat climate change and transition to sustainable energy.', publishedDate: new Date().toISOString(), source: 'World News' },
      { title: 'New Trade Agreement Signed', url: '', content: 'Major economies have signed a new trade agreement aimed at reducing tariffs and promoting international commerce.', publishedDate: new Date().toISOString(), source: 'Political Times' },
      { title: 'Election Results Incoming', url: '', content: 'Voting concludes in key regions with results expected to shape the political landscape for years to come.', publishedDate: new Date().toISOString(), source: 'News Agency' },
    ],
    business: [
      { title: 'Stock Markets Reach New Highs', url: '', content: 'Major stock indices have reached record highs driven by strong corporate earnings and positive economic indicators.', publishedDate: new Date().toISOString(), source: 'Financial Times' },
      { title: 'Startup Raises Major Funding', url: '', content: 'A promising tech startup has secured significant funding in its latest investment round, valuing the company at over $1 billion.', publishedDate: new Date().toISOString(), source: 'Business Daily' },
      { title: 'Global Economy Shows Resilience', url: '', content: 'Despite challenges, the global economy demonstrates resilience with growth projections remaining positive for the year.', publishedDate: new Date().toISOString(), source: 'Economy Watch' },
    ],
    science: [
      { title: 'Space Mission Achieves Milestone', url: '', content: 'A groundbreaking space mission has achieved its primary objective, gathering valuable data about distant celestial bodies.', publishedDate: new Date().toISOString(), source: 'Science Daily' },
      { title: 'Medical Research Breakthrough', url: '', content: 'Scientists announce a potential breakthrough in medical research that could lead to new treatments for chronic conditions.', publishedDate: new Date().toISOString(), source: 'Research Weekly' },
      { title: 'Climate Study Reveals New Findings', url: '', content: 'A comprehensive climate study has revealed important findings about environmental changes and their potential impact.', publishedDate: new Date().toISOString(), source: 'Nature Journal' },
    ],
    entertainment: [
      { title: 'Award Show Highlights Announced', url: '', content: 'Major entertainment award shows have announced their highlights and nominations, generating excitement among fans worldwide.', publishedDate: new Date().toISOString(), source: 'Entertainment News' },
      { title: 'Streaming Platform Releases New Content', url: '', content: 'Popular streaming platforms continue to expand their content libraries with new releases across various genres.', publishedDate: new Date().toISOString(), source: 'Media Watch' },
      { title: 'Celebrity Collaboration Announced', url: '', content: 'Exciting collaborations between major artists have been announced, promising unique musical experiences for fans.', publishedDate: new Date().toISOString(), source: 'Celebrity News' },
    ],
    health: [
      { title: 'Health Initiative Launched Globally', url: '', content: 'A new global health initiative has been launched to address public health challenges and promote wellness.', publishedDate: new Date().toISOString(), source: 'Health News' },
      { title: 'New Wellness Trends Emerge', url: '', content: 'Experts share insights on emerging wellness trends that are gaining popularity among health-conscious individuals.', publishedDate: new Date().toISOString(), source: 'Wellness Weekly' },
      { title: 'Fitness Technology Advances', url: '', content: 'New fitness technologies are revolutionizing how people track their health and achieve their wellness goals.', publishedDate: new Date().toISOString(), source: 'Fitness Tech' },
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
    ai: 'technology',
    crypto: 'cryptocurrency',
    bitcoin: 'cryptocurrency',
    politics: 'politics',
    world: 'politics',
    business: 'business',
    finance: 'business',
    science: 'science',
    entertainment: 'entertainment',
    health: 'health',
  };

  const normalizedPersona = persona.toLowerCase();
  let category = 'technology';

  for (const [key, value] of Object.entries(personaCategoryMap)) {
    if (normalizedPersona.includes(key)) {
      category = value;
      break;
    }
  }

  return fetchCategoryNews(category);
}
