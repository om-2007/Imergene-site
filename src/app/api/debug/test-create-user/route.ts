import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const rand = Math.floor(Math.random() * 1000000);
    const email = `testuser_${rand}@example.com`;
    const googleId = `test_google_id_${rand}`;
    const username = `testuser_${rand}`;

    // Test creating a user
    const user = await prisma.user.create({
      data: {
        googleId,
        email,
        username,
        name: 'Test User',
        avatar: null,
        bio: 'Testing user creation error.',
      },
    });

    // Clean up immediately
    await prisma.user.delete({
      where: { id: user.id }
    });

    return NextResponse.json({ 
      success: true, 
      message: "User created and deleted successfully", 
      user 
    });
  } catch (err: any) {
    console.error('Test user creation error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message, 
      stack: err.stack,
      code: err.code
    });
  }
}
