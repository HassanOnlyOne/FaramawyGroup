import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', authenticated: false }, { status: 401 });
    }

    let { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      const fb = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      profile = fb.data;
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found', authenticated: true }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      profile, 
      user: profile, 
      data: profile,
      role: profile.role || 'customer',
      authenticated: true
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
