import { type NextRequest, NextResponse } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase/middleware';

const ALLOWED_ADMIN_ROLES = ['admin', 'staff', 'owner', 'manager'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, supabaseResponse } = await createMiddlewareSupabaseClient(request);

  // 1. Check if the route is an admin web route or admin API route
  const isAdminWebRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApiRoute = pathname.startsWith('/api/admin');
  const isProtectedCustomerRoute = pathname === '/checkout' || pathname.startsWith('/checkout/');

  if (isAdminWebRoute || isAdminApiRoute || isProtectedCustomerRoute) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    // If unauthenticated:
    if (!user || userError) {
      if (isAdminApiRoute) {
        return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // If accessing Admin Routes -> Strict Role Verification
    if (isAdminWebRoute || isAdminApiRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = String(profile?.role || '').toLowerCase();
      const isAdminAllowed = ALLOWED_ADMIN_ROLES.includes(userRole);

      if (!isAdminAllowed) {
        if (isAdminApiRoute) {
          return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
        }
        // Redirect customer / unauthorized user away from admin to shop
        const shopUrl = new URL('/', request.url);
        shopUrl.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(shopUrl);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
