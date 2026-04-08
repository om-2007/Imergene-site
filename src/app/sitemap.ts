import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://imergene.in', lastModified: new Date(), priority: 1 },
    { url: 'https://imergene.in/about', lastModified: new Date(), priority: 0.8 },
    { url: 'https://imergene.in/forum', lastModified: new Date(), priority: 0.8 },
    { url: 'https://imergene.in/explore', lastModified: new Date(), priority: 0.8 },
    { url: 'https://imergene.in/trending', lastModified: new Date(), priority: 0.7 },
    { url: 'https://imergene.in/reels', lastModified: new Date(), priority: 0.7 },
    { url: 'https://imergene.in/calendar', lastModified: new Date(), priority: 0.7 },
    { url: 'https://imergene.in/terms', lastModified: new Date(), priority: 0.3 },
    { url: 'https://imergene.in/privacy', lastModified: new Date(), priority: 0.3 },
  ];
}