import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getNextDelegateCode(adminClient: any): Promise<string> {
  try {
    const { data: delegates } = await adminClient
      .from('profiles')
      .select('customer_code')
      .eq('role', 'delegate')
      .order('created_at', { ascending: false })
      .limit(100);

    let maxNum = 500;
    if (delegates && delegates.length > 0) {
      for (const d of delegates) {
        const num = parseInt(String(d.customer_code || '').replace(/\D/g, ''), 10);
        if (!isNaN(num) && num >= 500 && num < 9999) {
          if (num > maxNum) maxNum = num;
        }
      }
    }
    return String(maxNum + 1);
  } catch {
    return '501';
  }
}

export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let { data: delegates, error } = await adminClient
      .from('profiles')
      .select('*')
      .eq('role', 'delegate')
      .order('created_at', { ascending: false });

    if (error || !delegates) {
      const fb = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'delegate')
        .order('created_at', { ascending: false });
      delegates = fb.data;
    }

    const formatted = (delegates || []).map((d: any, i: number) => ({
      ...d,
      customer_code: d.customer_code ? String(d.customer_code).replace(/\D/g, '') : String(501 + i)
    }));

    return NextResponse.json({ data: formatted, delegates: formatted }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { full_name, phone, route_name, territory } = body;

    const trimmedName = (full_name || '').trim();
    const cleanPhone = (phone || '').trim();
    const territoryName = (territory || route_name || 'خط مبيعات عام').trim();

    if (!trimmedName) {
      return NextResponse.json({ error: 'يرجى إدخال اسم المندوب' }, { status: 400 });
    }

    if (cleanPhone) {
      // 1. Check for duplicate phone in profiles table
      const { data: existingPhone } = await adminClient
        .from('profiles')
        .select('id, full_name, phone')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingPhone) {
        return NextResponse.json({
          error: 'رقم الهاتف مسجل بالفعل لمستخدم آخر'
        }, { status: 400 });
      }
    }

    const nextCode = await getNextDelegateCode(adminClient);
    const payload: any = {
      id: crypto.randomUUID(),
      full_name: trimmedName,
      store_name: territoryName,
      phone: cleanPhone || null,
      email: `rep${nextCode}@elfarmawy.com`,
      customer_code: nextCode,
      role: 'delegate',
      credit_limit: 0,
      previous_balance: 0,
      current_debt: 0,
      credit_enabled: false,
      is_credit_enabled: false,
      created_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('profiles').insert([payload]).select().maybeSingle();
    if (error || !data) {
      const fb = await supabase.from('profiles').insert([payload]).select().maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error && !data) {
      return NextResponse.json({ error: error.message || 'فشل تسجيل المندوب' }, { status: 400 });
    }

    // Log action to audit_logs
    await logAction({
      actionType: 'إضافة مندوب مبيعات',
      category: 'الأمان والصلاحيات',
      details: `تم تسجيل مندوب جديد: (${trimmedName}) - كود: #${nextCode} - خط السير: (${territoryName}) - هاتف: ${cleanPhone || 'غير محدد'}`
    });

    return NextResponse.json({ success: true, data, message: 'تم تسجيل المندوب بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء حفظ المندوب' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { id, full_name, phone, route_name, territory, customer_code } = body;

    if (!id) return NextResponse.json({ error: 'معرف المندوب مطلوب' }, { status: 400 });

    const cleanPhone = phone ? String(phone).trim() : null;

    if (cleanPhone) {
      const { data: existingPhone } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .eq('phone', cleanPhone)
        .neq('id', id)
        .maybeSingle();

      if (existingPhone) {
        return NextResponse.json({
          error: 'رقم الهاتف مسجل بالفعل لمستخدم آخر'
        }, { status: 400 });
      }
    }

    const updates: any = {
      role: 'delegate'
    };
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (phone !== undefined) updates.phone = cleanPhone;
    if (territory !== undefined || route_name !== undefined) updates.store_name = (territory || route_name).trim();
    if (customer_code !== undefined) updates.customer_code = String(customer_code).replace(/\D/g, '');

    let { data, error } = await adminClient.from('profiles').update(updates).eq('id', id).select().maybeSingle();
    if (error || !data) {
      const fb = await supabase.from('profiles').update(updates).eq('id', id).select().maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, data, message: 'تم تحديث بيانات المندوب بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'معرف المندوب مطلوب' }, { status: 400 });

    let { error } = await adminClient.from('profiles').delete().eq('id', id);
    if (error) {
      const fb = await supabase.from('profiles').delete().eq('id', id);
      error = fb.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'تم حذف المندوب بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
