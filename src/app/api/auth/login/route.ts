import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = (body.identifier || body.email || body.phone || '').trim();
    const password = body.password;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'يرجى إدخال رقم الهاتف / البريد الإلكتروني وكلمة المرور' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    let targetEmail = identifier;
    const isPhoneLike = /^[0-9+()-\s]{8,15}$/.test(identifier) || !identifier.includes('@');

    if (isPhoneLike) {
      const cleanPhone = identifier.replace(/\D/g, '');
      
      // Look up profile by phone or customer_code
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, email, phone, customer_code, role')
        .or(`phone.eq.${cleanPhone},customer_code.eq.${cleanPhone}`)
        .maybeSingle();

      if (profile && profile.email) {
        targetEmail = profile.email;
      } else {
        targetEmail = `${cleanPhone}@el-farmawy.com`;
      }
    }

    // Attempt Sign In
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (authError && isPhoneLike) {
      const cleanPhone = identifier.replace(/\D/g, '');
      const candidateDomains = [
        `${cleanPhone}@el-farmawy.com`,
        `${cleanPhone}@elfarmawy.store`,
        `${cleanPhone}@store.local`
      ];

      for (const candEmail of candidateDomains) {
        if (candEmail === targetEmail) continue;
        const retry = await supabase.auth.signInWithPassword({
          email: candEmail,
          password
        });
        if (!retry.error && retry.data.user) {
          authData = retry.data;
          authError = null;
          break;
        }
      }
    }

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة. يرجى التأكد من رقم الهاتف / البريد وكلمة المرور' }, { status: 401 });
    }

    // Fetch user profile to return role
    let { data: userProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!userProfile) {
      const fb = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
      userProfile = fb.data;
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      session: authData.session,
      role: userProfile?.role || 'customer',
      profile: userProfile
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
