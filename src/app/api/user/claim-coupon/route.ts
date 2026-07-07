import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { neon } from '@neondatabase/serverless';

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
    const databaseUrl = process.env.BLUE_ADMIN_DATABASE_URL;
    let rewardAmount = 100;
    let couponIdToUpdate: number | null = null;

    if (databaseUrl) {
      // Connect to blue-admin database
      const sql = neon(databaseUrl);
      const coupons = await sql`SELECT * FROM coupons WHERE UPPER(code) = ${cleanCode} LIMIT 1` as any[];
      
      if (!coupons || coupons.length === 0) {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
      }

      const coupon = coupons[0];

      // Validate active status
      if (Number(coupon.is_active) !== 1) {
        return NextResponse.json({ error: 'This coupon is currently disabled' }, { status: 400 });
      }

      // Validate dates
      const nowMs = Date.now();
      if (coupon.expires_at && Number(coupon.expires_at) < nowMs) {
        return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 });
      }

      if (coupon.valid_from && Number(coupon.valid_from) > nowMs) {
        return NextResponse.json({ error: 'This coupon is not valid yet' }, { status: 400 });
      }

      // Validate usage limits
      if (coupon.max_uses > 0 && Number(coupon.times_used) >= Number(coupon.max_uses)) {
        return NextResponse.json({ error: 'This coupon has reached its maximum usage limit' }, { status: 400 });
      }

      rewardAmount = Number(coupon.reward_amount) || 100;
      couponIdToUpdate = coupon.id;
    } else {
      // Fallback to static code logic if database URL is missing
      const EXPECTED_COUPON = process.env.MONDAY_COUPON_CODE || 'BLUE100MONDAY';
      if (cleanCode !== EXPECTED_COUPON) {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
      }
    }

    // Check if already claimed in Imergene
    const existingClaim = await prisma.couponClaim.findUnique({
      where: {
        userId_couponCode: {
          userId: payload.id,
          couponCode: cleanCode,
        },
      },
    });

    if (existingClaim) {
      return NextResponse.json({ error: 'You have already claimed this coupon!' }, { status: 400 });
    }

    // Award IMR and record claim transactionally on Imergene
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
            increment: rewardAmount,
          },
        },
        select: {
          imrBalance: true,
        },
      });

      return updatedUser;
    });

    // Increment times_used in blue-admin database if coupon matches
    if (databaseUrl && couponIdToUpdate) {
      try {
        const sql = neon(databaseUrl);
        await sql`UPDATE coupons SET times_used = times_used + 1 WHERE id = ${couponIdToUpdate}`;
      } catch (dbErr) {
        console.error('Failed to increment times_used in blue-admin db:', dbErr);
        // Do not crash the response since the user has already received the IMR tokens on Imergene
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully claimed ${rewardAmount} IMR!`,
      imrBalance: result.imrBalance,
    });

  } catch (err: any) {
    console.error('Claim coupon error:', err);
    return NextResponse.json({ error: err.message || 'Failed to claim coupon' }, { status: 500 });
  }
}
