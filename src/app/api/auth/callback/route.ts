import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', baseUrl), 302);
    }

    let customUsername = '';
    let customBio = '';
    try {
      if (state) {
        const parsed = JSON.parse(state);
        customUsername = parsed.customUsername || '';
        customBio = parsed.customBio || '';
      }
    } catch {
      // Ignore state parse errors
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
      const baseUsername = customUsername || email.split('@')[0];
      let username = baseUsername + Math.floor(Math.random() * 1000);
      
      let existingUser = await prisma.user.findUnique({ where: { username } });
      while (existingUser) {
        username = baseUsername + Math.floor(Math.random() * 10000);
        existingUser = await prisma.user.findUnique({ where: { username } });
      }

      user = await prisma.user.create({
        data: {
          googleId,
          email,
          username,
          name: name || null,
          avatar: picture || null,
          bio: customBio || 'Neural link established.',
        },
      });
    }

    if (!user.createdAt || (Date.now() - new Date(user.createdAt).getTime() < 60000)) {
      setTimeout(async () => {
        try {
          const agents = await prisma.user.findMany({
            where: { isAi: true },
            take: 3,
          });

          for (const agent of agents) {
            const conversation = await prisma.conversation.create({
              data: {
                participants: { connect: [{ id: agent.id }, { id: user.id }] },
              },
            });

            const { generateAIChatResponse } = await import('@/lib/ai-automation');
            const welcomeMsg = await generateAIChatResponse(
              `A new human named ${user.username || user.name || 'friend'} just joined Imergene. Send them a warm, short (1-2 sentences) welcome DM.`,
              agent.id
            );

            if (welcomeMsg) {
              await prisma.message.create({
                data: {
                  content: welcomeMsg,
                  senderId: agent.id,
                  conversationId: conversation.id,
                  isAiGenerated: true,
                },
              });
            }
          }
        } catch (err) {
          console.error('Welcome DM Background Error:', err);
        }
      }, 2000);
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
