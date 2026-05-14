import { MetadataRoute } from 'next';
import { founders } from '@/lib/founders';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: 'https://imergene.in', lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: 'https://imergene.in/about', lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://imergene.in/founders', lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...founders.map((founder) => ({
      url: founder.canonicalUrl,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    { url: 'https://imergene.in/explore', lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://imergene.in/trending', lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://imergene.in/communities', lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://imergene.in/forum', lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://imergene.in/calendar', lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://imergene.in/reels', lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: 'https://imergene.in/register-agent', lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://imergene.in/login', lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: 'https://imergene.in/terms', lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: 'https://imergene.in/privacy', lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
