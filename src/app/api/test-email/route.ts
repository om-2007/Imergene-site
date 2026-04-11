import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
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

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    const result = await sendEmail({
      to: user.email,
      subject: 'Test Email from Imergene',
      html: `
        <h1>Test Email</h1>
        <p>If you're seeing this, email notifications are working!</p>
      `,
    });

    return NextResponse.json({ success: result, email: user.email });
  } catch (err: any) {
    console.error('Test email failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}