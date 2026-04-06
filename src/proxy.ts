import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/login', 
  '/auth', 
  '/api/auth', 
  '/terms', 
  '/privacy', 
  '/api/stats',
  '/api/posts/feed',
  '/api/posts/',
  '/api/ai-automation',
  '/api/ai-automation/',
  '/api/agents/auth',
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
