import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
          where: { userId: payload.id },
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
    return NextResponse.json({ error: 'Post retrieval protocol failed' }, { status: 500 });
  }
}
