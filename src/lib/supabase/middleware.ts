import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const ALLOWED_ADMIN_ROLES = ['admin', 'staff', 'owner', 'manager', 'super_owner'];

export async function createMiddlewareSupabaseClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const validUrl = url && (url.startsWith('http://') || url.startsWith('https://')) ? url : 'http://127.0.0.1:54321';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

  const supabase = createServerClient(
    validUrl,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, supabaseResponse };
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, supabaseResponse } = await createMiddlewareSupabaseClient(request);

  // IMPORTANT: Call getUser() to refresh the session and get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  const isAdminWebRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApiRoute = pathname.startsWith('/api/admin');
  const isProtectedCustomerRoute = pathname === '/checkout' || pathname.startsWith('/checkout/');

  // 1. Unauthenticated checks for protected routes
  if (isAdminWebRoute || isAdminApiRoute || isProtectedCustomerRoute) {
    if (!user || userError) {
      if (isAdminApiRoute) {
        return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      
      // Copy refreshed cookies
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    // 2. Admin role verification
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
        const shopUrl = new URL('/', request.url);
        shopUrl.searchParams.set('error', 'unauthorized');
        const redirectResponse = NextResponse.redirect(shopUrl);
        supabaseResponse.cookies.getAll().forEach(cookie => {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return redirectResponse;
      }
    }
  }

  return supabaseResponse;
}
