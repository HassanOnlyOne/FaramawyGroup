import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getNextCustomerCode(adminClient: any, supabase: any): Promise<string> {
  try {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('customer_code')
      .order('created_at', { ascending: false })
      .limit(200);

    let maxCode = 999;
    if (profiles && profiles.length > 0) {
      for (const prof of profiles) {
        const num = parseInt(String(prof.customer_code || '').replace(/\D/g, ''), 10);
        if (!isNaN(num) && num >= 1000 && num < 999999) {
          if (num > maxCode) maxCode = num;
        }
      }
    }
    return String(maxCode + 1);
  } catch {
    return '1000';
  }
}

function translateAuthError(msg: string): string {
  const m = String(msg || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already exists') || m.includes('duplicate')) {
    return 'رقم الهاتف أو البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.';
  }
  if (m.includes('password') && (m.includes('short') || m.includes('least') || m.includes('6'))) {
    return 'كلمة المرور يجب أن تتكون من 6 خانات أو أحرف على الأقل.';
  }
  if (m.includes('valid email') || m.includes('invalid email') || m.includes('email format')) {
    return 'البريد الإلكتروني المدخل غير صالح.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'تم إرسال طلبات متعددة بسرعة، يرجى الانتظار دقيقة والمحاولة مجدداً.';
  }
  return msg || 'حدث خطأ أثناء إنشاء الحساب';
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, phone, store_name, address } = await req.json();

    const cleanName = String(full_name || store_name || '').trim();
    if (!cleanName) {
      return NextResponse.json({ error: 'اسم العميل / اسم المنشأة مطلوب' }, { status: 400 });
    }

    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 خانات على الأقل' }, { status: 400 });
    }

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;
    if (!cleanPhone || !egyptianPhoneRegex.test(cleanPhone)) {
      return NextResponse.json({ error: 'رقم الهاتف يجب أن يتكون من 11 رقماً ويبدأ بـ (010, 011, 012, 015)' }, { status: 400 });
    }

    // Default target email using el-farmawy.com domain
    const targetEmail = (email && email.trim()) 
      ? email.trim().toLowerCase() 
      : `${cleanPhone}@el-farmawy.com`;

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check if phone or email already exists in profiles
    const { data: existingProfiles } = await adminClient
      .from('profiles')
      .select('id, phone, email, customer_code')
      .or(`email.eq.${targetEmail},phone.eq.${cleanPhone}`);

    if (existingProfiles && existingProfiles.length > 0) {
      const match = existingProfiles[0];
      if (match.phone === cleanPhone) {
        return NextResponse.json({ error: 'رقم الهاتف هذا مسجل بالفعل. يرجى تسجيل الدخول.' }, { status: 400 });
      }
      if (match.email === targetEmail) {
        return NextResponse.json({ error: 'البريد الإلكتروني هذا مسجل بالفعل. يرجى تسجيل الدخول.' }, { status: 400 });
      }
    }

    // Sign up via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: targetEmail,
      password: password,
      options: {
        data: {
          full_name: cleanName,
          phone: cleanPhone,
          address: address ? String(address).trim() : '',
        }
      }
    });

    if (authError) {
      return NextResponse.json({ error: translateAuthError(authError.message) }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'فشل إنشاء حساب المستخدم' }, { status: 400 });
    }

    const customerCode = await getNextCustomerCode(adminClient, supabase);

    // Profile payload: newly registered merchants start with credit_enabled: false and credit_limit: 0
    const profilePayload = {
      id: authData.user.id,
      email: targetEmail,
      full_name: cleanName,
      store_name: cleanName,
      phone: cleanPhone,
      address: address ? String(address).trim() : null,
      customer_code: customerCode,
      role: 'customer',
      credit_limit: 0,
      current_debt: 0,
      previous_balance: 0,
      credit_enabled: false,
      is_credit_enabled: false,
      created_at: new Date().toISOString()
    };

    let { error: profileError } = await adminClient
      .from('profiles')
      .upsert(profilePayload);

    if (profileError) {
      const fb = await supabase.from('profiles').upsert(profilePayload);
      profileError = fb.error;
    }

    return NextResponse.json({ 
      success: true,
      user: authData.user, 
      customer_code: customerCode, 
      profile: profilePayload,
      message: 'تم تسجيل حساب التاجر بنجاح' 
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: translateAuthError(err.message) }, { status: 500 });
  }
}
