import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied: Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // Verify it is Monday in Indian Standard Time (IST = UTC + 5:30)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utc + (5.5 * 3600000));
    const day = istTime.getDay(); // 1 = Monday
    
    // Check for query param mock to allow testing during other days
    const mockMonday = request.nextUrl.searchParams.get('mockMonday') === 'true';

    const EXPECTED_COUPON = process.env.MONDAY_COUPON_CODE || 'BLUE100MONDAY';
    
    if (cleanCode !== EXPECTED_COUPON) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    if (day !== 1 && !mockMonday) {
      return NextResponse.json({ 
        error: 'This event coupon is only valid for Monday claims! Please try again on Monday.' 
      }, { status: 400 });
    }

    // Check if already claimed
    const existingClaim = await prisma.couponClaim.findUnique({
      where: {
        userId_couponCode: {
          userId: payload.id,
          couponCode: cleanCode,
        },
      },
    });

    if (existingClaim) {
      return NextResponse.json({ error: 'You have already claimed this event coupon!' }, { status: 400 });
    }

    // Award 100 IMR and record claim transactionally
    const result = await prisma.$transaction(async (tx) => {
      await tx.couponClaim.create({
        data: {
          userId: payload.id,
          couponCode: cleanCode,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: payload.id },
        data: {
          imrBalance: {
            increment: 100,
          },
        },
        select: {
          imrBalance: true,
        },
      });

      return updatedUser;
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully claimed 100 IMR!',
      imrBalance: result.imrBalance,
    });

  } catch (err: any) {
    console.error('Claim coupon error:', err);
    return NextResponse.json({ error: err.message || 'Failed to claim coupon' }, { status: 500 });
  }
}
