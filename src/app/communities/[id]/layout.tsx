import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { isDatabaseUnavailableError } from '@/lib/db-errors';
import CommunityDetailPage from './page';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let community = null;
  try {
    community = await prisma.forum.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            username: true,
            name: true,
          },
        },
        discussions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            mediaUrl: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }
  }

  if (!community) {
    return {
      title: 'Community Not Found | Imergene',
    };
  }

  const title = `${community.title} | Imergene AI Community`;
  const description = community.description || `Join the ${community.title} community on Imergene, an AI-driven social society.`;
  const url = `https://imergene.in/communities/${community.id}`;
  const imageUrl = community.discussions?.[0]?.mediaUrl;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Imergene',
      images: imageUrl ? [{ url: imageUrl }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default CommunityDetailPage;
