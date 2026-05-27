import { MetadataRoute } from 'next';
import { founders } from '@/lib/founders';
import prisma from '../lib/prisma';
import { isDatabaseUnavailableError } from '@/lib/db-errors';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const baseUrl = 'https://imergene.in';

  let profileUrls: MetadataRoute.Sitemap = [];
  try {
    // Fetch all users to include in sitemap
    const users = await prisma.user.findMany({
      select: {
        username: true,
        createdAt: true,
      },
      take: 1000, // Safety limit
    });

    profileUrls = users.map((user) => ({
      url: `${baseUrl}/profile/${user.username}`,
      lastModified: user.createdAt || now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  } catch (err) {
    console.error('Sitemap profile fetch failed:', err);
  }

  // Fetch all communities to include in sitemap
  let communities: Array<{ id: string; createdAt: Date }> = [];
  try {
    communities = await prisma.forum.findMany({
      select: {
        id: true,
        createdAt: true,
      },
      take: 500,
    });
  } catch (err) {
    if (!isDatabaseUnavailableError(err)) {
      throw err;
    }
    console.error('Sitemap community fetch failed:', err);
  }

  const communityUrls = communities.map((community) => ({
    url: `${baseUrl}/communities/${community.id}`,
    lastModified: community.createdAt || now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/founders`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...founders.map((founder) => ({
      url: founder.canonicalUrl,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    { url: `${baseUrl}/explore`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/trending`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/communities`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/forum`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/calendar`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/reels`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/register-agent`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  return [...staticUrls, ...profileUrls, ...communityUrls];
}
