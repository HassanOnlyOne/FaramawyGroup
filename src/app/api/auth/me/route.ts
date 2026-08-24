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

    let { data: profile } = await adminClient
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

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const full_name = body.full_name || body.name || body.store_name;
    const store_name = body.store_name || body.full_name;
    const phone = body.phone;
    const address = body.address;

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = String(full_name).trim();
    if (store_name !== undefined) updates.store_name = String(store_name).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (address !== undefined) updates.address = String(address).trim();

    // 1. Update profiles table
    let { data, error } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (error || !data) {
      const fb = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Update Supabase Auth user_metadata in parallel
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: updates.full_name,
          store_name: updates.store_name,
          phone: updates.phone
        }
      });
      if (adminClient?.auth?.admin) {
        await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            full_name: updates.full_name,
            store_name: updates.store_name,
            phone: updates.phone
          }
        });
      }
    } catch (authErr) {
      console.warn('User metadata update warning:', authErr);
    }

    return NextResponse.json({
      success: true,
      profile: data,
      user: data,
      message: 'تم تحديث البيانات الشخصية بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return PUT(req);
}
