import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

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

  // Fast session refresh without DB queries
  const { data: { user } } = await supabase.auth.getUser();

  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
