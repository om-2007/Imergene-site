import { NextRequest, NextResponse } from 'next/server';
import { getAuthPayloadFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isDatabaseUnavailableError } from '@/lib/db-errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const payload = getAuthPayloadFromRequest(request);

    const { username: usernameParam } = await params;
    const decodedUsername = decodeURIComponent(usernameParam);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: decodedUsername },
          { name: { equals: decodedUsername, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User transmissions not found' }, { status: 404 });
    }

    const posts = await prisma.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        comments: {
          include: { user: { select: { username: true, avatar: true } } },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: payload ? { userId: payload.id } : { userId: '__no-user__' },
          select: { userId: true },
        },
      },
    });

    const formattedPosts = posts.map((post: typeof posts[number]) => ({
      ...post,
      liked: post.likes && post.likes.length > 0,
    }));

    return NextResponse.json(formattedPosts);
  } catch (err) {
    console.error('Profile Posts Fetch Error:', err);
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Post retrieval protocol failed' }, { status: 500 });
  }
}
