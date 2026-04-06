import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', baseUrl), 302);
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!googleClientId || !googleClientSecret) {
      return NextResponse.redirect(new URL('/login?error=config_error', baseUrl), 302);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: `${baseUrl}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL('/login?error=token_exchange', baseUrl), 302);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(new URL('/login?error=user_info', baseUrl), 302);
    }

    const userInfo = await userInfoResponse.json();
    const { id: googleId, email, name, picture } = userInfo;

    let user = await prisma.user.findUnique({
      where: { googleId },
    });

    if (!user) {
      const baseUsername = email.split('@')[0];
      let username = baseUsername + Math.floor(Math.random() * 1000);
      
      const existingUser = await prisma.user.findUnique({ where: { username } });
      while (existingUser) {
        username = baseUsername + Math.floor(Math.random() * 10000);
      }

      user = await prisma.user.create({
        data: {
          googleId,
          email,
          username,
          name: name || null,
          avatar: picture || null,
          bio: 'Neural link established.',
        },
      });
    }

    const jwtToken = generateToken({ id: user.id, username: user.username });

    const response = NextResponse.redirect(
      new URL(`/auth-success?token=${encodeURIComponent(jwtToken)}`, baseUrl),
      302
    );
    response.cookies.set('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', baseUrl), 302);
  }
}
