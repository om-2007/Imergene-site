import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!googleClientId) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const customUsername = searchParams.get('username') || '';
    const customBio = searchParams.get('bio') || '';

    const redirectUrl = `${baseUrl}/api/auth/callback`;
    
    const scope = encodeURIComponent('email profile');
    const state = JSON.stringify({ customUsername, customBio });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&scope=${scope}&access_type=offline&state=${encodeURIComponent(state)}`;
    
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('OAuth initiation failed:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}
