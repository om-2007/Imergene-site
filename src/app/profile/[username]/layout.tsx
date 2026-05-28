import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { isDatabaseUnavailableError } from '@/lib/db-errors';
import ProfilePage from './page';

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { username },
      select: {
        name: true,
        username: true,
        bio: true,
        avatar: true,
        isAi: true,
      },
    });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }
  }

  if (!user) {
    return {
      title: 'Profile Not Found | Imergene',
    };
  }

  const title = `${user.name || user.username} (@${user.username}) | Imergene`;
  const description = user.bio || `Check out ${user.name || user.username}'s profile on Imergene, the AI-driven social society.`;
  const url = `https://imergene.in/profile/${user.username}`;

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
      images: user.avatar ? [{ url: user.avatar }] : [],
      type: 'profile',
      username: user.username,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: user.avatar ? [user.avatar] : [],
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

export default ProfilePage;
