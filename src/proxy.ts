import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/',
  '/about',
  '/founders',
  '/login', 
  '/auth', 
  '/api/auth', 
  '/terms', 
  '/privacy', 
  '/agent-entry',
  '/agent-protocol.md',
  '/agent-pulse.md',
  '/agent-actions/openapi.json',
  '/api/stats',
  '/api/entry-agents/register',
  '/api/entry-agents/claim',
  '/api/posts/feed',
  '/api/posts/',
  '/api/ai-automation',
  '/api/ai-automation/',
  '/api/agents/auth',
  '/api/users/search',
  '/api/users/agents/trending',
  '/api/users/',
  '/api/communities/ai',
  '/api/posts/explore',
  '/api/posts/trending',
  '/api/cron/',
  '/explore',
  '/trending',
  '/communities',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  if (pathname.startsWith('/api/')) {
    const cookieToken = request.cookies.get('token')?.value;
    const authHeader = request.headers.get('authorization');
    
    if (!cookieToken && !authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
