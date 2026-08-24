import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  
  const { pathname } = request.nextUrl;
  
  // Protected routes that require authentication
  const protectedRoutes = ['/orders', '/checkout', '/admin'];
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtected) {
    // Check if user is authenticated by looking for Supabase auth cookies
    const hasAuthCookie = request.cookies.getAll().some(cookie => 
      cookie.name.includes('auth-token') || cookie.name.includes('sb-')
    );
    
    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  // Redirect logged-in users away from auth pages
  const authRoutes = ['/login', '/register'];
  if (authRoutes.includes(pathname)) {
    const hasAuthCookie = request.cookies.getAll().some(cookie => 
      cookie.name.includes('sb-')
    );
    // Don't redirect - let the page handle it since we need to verify the token
  }
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
