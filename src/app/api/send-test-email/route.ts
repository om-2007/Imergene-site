import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      return NextResponse.json({ error: 'User not found or no email' }, { status: 404 });
    }

    console.log('[Test] Sending email to:', user.email);

    const result = await sendEmail({
      to: user.email,
      subject: 'Test Email from Imergene',
      html: `
        <h1>Test Email</h1>
        <p>If you're seeing this, email notifications are working on production!</p>
      `,
    });

    return NextResponse.json({ success: result, email: user.email });
  } catch (err: any) {
    console.error('Test failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}