import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { views: { increment: 1 } },
    });

    return NextResponse.json({ success: true, views: updatedPost.views });
  } catch (err) {
    console.error('View update failed:', err);
    return NextResponse.json({ error: 'Failed to update view count' }, { status: 500 });
  }
}
