import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory fallback buffer for delegates directory
let memoryDelegates: any[] = [];

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

// GET: List all delegates
export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let allDelegates: any[] = [];

    // 1. Try querying dedicated `delegates` table
    try {
      const { data: dbDelegates, error: dbErr } = await adminClient
        .from('delegates')
        .select('*')
        .order('created_at', { ascending: false });

      if (!dbErr && dbDelegates && dbDelegates.length > 0) {
        allDelegates = dbDelegates;
      }
    } catch {}

    // 2. Also query `profiles` where role = 'delegate' as fallback / synchronization
    if (allDelegates.length === 0) {
      try {
        let { data: profileDelegates, error: profErr } = await adminClient
          .from('profiles')
          .select('*')
          .eq('role', 'delegate')
          .order('created_at', { ascending: false });

        if (profErr || !profileDelegates) {
          const fb = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'delegate')
            .order('created_at', { ascending: false });
          profileDelegates = fb.data;
        }

        if (profileDelegates && profileDelegates.length > 0) {
          allDelegates = profileDelegates;
        }
      } catch {}
    }

    // 3. Merge with in-memory fallback
    const delMap = new Map<string, any>();
    allDelegates.forEach(d => delMap.set(d.id, d));
    memoryDelegates.forEach(d => delMap.set(d.id, d));

    const finalDelegates = Array.from(delMap.values()).map((d: any, i: number) => ({
      id: d.id,
      full_name: d.full_name || d.name || 'مندوب مبيعات',
      phone: d.phone || null,
      territory: d.territory || d.store_name || d.route_name || 'خط مبيعات عام',
      route_name: d.territory || d.store_name || d.route_name || 'خط مبيعات عام',
      is_active: d.is_active !== undefined ? Boolean(d.is_active) : true,
      notes: d.notes || null,
      customer_code: d.customer_code ? String(d.customer_code).replace(/\D/g, '') : String(501 + i),
      created_at: d.created_at || new Date().toISOString()
    }));

    finalDelegates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ success: true, data: finalDelegates, delegates: finalDelegates }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Add a new delegate
export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { full_name, phone, territory, route_name, is_active = true, notes } = body;

    const trimmedName = (full_name || '').trim();
    const cleanPhone = phone ? String(phone).trim() : null;
    const territoryName = (territory || route_name || 'خط مبيعات عام').trim();

    if (!trimmedName) {
      return NextResponse.json({ error: 'يرجى إدخال اسم المندوب' }, { status: 400 });
    }

    const nextCode = await getNextDelegateCode(adminClient);
    const delegateId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const delegateRecord: any = {
      id: delegateId,
      full_name: trimmedName,
      phone: cleanPhone,
      territory: territoryName,
      route_name: territoryName,
      is_active: is_active !== false,
      notes: notes ? String(notes).trim() : null,
      customer_code: nextCode,
      created_at: nowIso,
      updated_at: nowIso
    };

    // Save in memory buffer
    memoryDelegates.unshift(delegateRecord);

    // 1. Try inserting into `delegates` table
    let inserted = null;
    try {
      const { data, error } = await adminClient
        .from('delegates')
        .insert([delegateRecord])
        .select()
        .maybeSingle();

      if (!error && data) {
        inserted = data;
      }
    } catch {}

    // 2. Also insert / sync into `profiles` table
    try {
      const profilePayload = {
        id: delegateId,
        full_name: trimmedName,
        store_name: territoryName,
        phone: cleanPhone,
        email: `rep${nextCode}@elfarmawy.com`,
        customer_code: nextCode,
        role: 'delegate',
        credit_limit: 0,
        previous_balance: 0,
        current_debt: 0,
        credit_enabled: false,
        is_credit_enabled: false,
        created_at: nowIso
      };

      await adminClient.from('profiles').insert([profilePayload]);
    } catch {}

    // 3. Resolve current authenticated admin for audit log
    let currentAdminProfile: any = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ap } = await adminClient
          .from('profiles')
          .select('id, full_name, store_name, role')
          .eq('id', user.id)
          .maybeSingle();
        currentAdminProfile = ap;
      }
    } catch {}

    const adminName = currentAdminProfile?.full_name || currentAdminProfile?.store_name || 'المدير';

    // 4. Log Action to Audit Logs
    await logAction({
      actionType: 'إضافة مندوب جديد',
      category: 'المندوبين والمشرفين',
      details: `تم تسجيل المندوب الجديد [${trimmedName}] - هاتف: [${cleanPhone || 'غير محدد'}] - خط السير: [${territoryName}]`,
      user: {
        id: currentAdminProfile?.id,
        name: adminName,
        role: 'admin'
      }
    });

    return NextResponse.json({
      success: true,
      data: inserted || delegateRecord,
      message: 'تم تسجيل المندوب بنجاح'
    }, { status: 201 });

  } catch (err: any) {
    console.error('Delegate POST error:', err);
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء حفظ المندوب' }, { status: 500 });
  }
}

// PUT: Update delegate
export async function PUT(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { id, full_name, phone, territory, route_name, is_active, notes, customer_code } = body;

    if (!id) {
      return NextResponse.json({ error: 'معرف المندوب مطلوب' }, { status: 400 });
    }

    const trimmedName = full_name ? String(full_name).trim() : 'مندوب';
    const cleanPhone = phone ? String(phone).trim() : null;
    const territoryName = (territory || route_name) ? String(territory || route_name).trim() : undefined;
    const nowIso = new Date().toISOString();

    const updates: any = {
      updated_at: nowIso
    };
    if (full_name !== undefined) updates.full_name = trimmedName;
    if (phone !== undefined) updates.phone = cleanPhone;
    if (territoryName !== undefined) {
      updates.territory = territoryName;
      updates.route_name = territoryName;
      updates.store_name = territoryName;
    }
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (notes !== undefined) updates.notes = notes ? String(notes).trim() : null;
    if (customer_code !== undefined) updates.customer_code = String(customer_code).replace(/\D/g, '');

    // Update in memory
    memoryDelegates = memoryDelegates.map(d => d.id === id ? { ...d, ...updates } : d);

    // 1. Try update in `delegates` table
    try {
      await adminClient.from('delegates').update(updates).eq('id', id);
    } catch {}

    // 2. Also update in `profiles` table
    try {
      const profileUpdates: any = { role: 'delegate' };
      if (updates.full_name) profileUpdates.full_name = updates.full_name;
      if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
      if (updates.territory) profileUpdates.store_name = updates.territory;
      if (updates.customer_code) profileUpdates.customer_code = updates.customer_code;

      await adminClient.from('profiles').update(profileUpdates).eq('id', id);
    } catch {}

    // 3. Resolve current authenticated admin
    let currentAdminProfile: any = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ap } = await adminClient
          .from('profiles')
          .select('id, full_name, store_name, role')
          .eq('id', user.id)
          .maybeSingle();
        currentAdminProfile = ap;
      }
    } catch {}

    const adminName = currentAdminProfile?.full_name || currentAdminProfile?.store_name || 'المدير';

    // 4. Log Action to Audit Logs
    await logAction({
      actionType: 'تعديل بيانات مندوب',
      category: 'المندوبين والمشرفين',
      details: `تم تحديث بيانات المندوب [${trimmedName}] (تعديل خط السير أو الهاتف أو حالة التفعيل)`,
      user: {
        id: currentAdminProfile?.id,
        name: adminName,
        role: 'admin'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'تم تحديث بيانات المندوب بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Delegate PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete delegate
export async function DELETE(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    let targetName = searchParams.get('name') || '';

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
      if (body.name || body.full_name) targetName = body.name || body.full_name;
    }

    if (!id) {
      return NextResponse.json({ error: 'معرف المندوب مطلوب' }, { status: 400 });
    }

    // Fetch delegate name if not passed
    if (!targetName) {
      try {
        const mem = memoryDelegates.find(d => d.id === id);
        if (mem) targetName = mem.full_name;

        if (!targetName) {
          const { data: d } = await adminClient.from('delegates').select('full_name').eq('id', id).maybeSingle();
          if (d) targetName = d.full_name;
        }

        if (!targetName) {
          const { data: p } = await adminClient.from('profiles').select('full_name').eq('id', id).maybeSingle();
          if (p) targetName = p.full_name;
        }
      } catch {}
    }

    const finalDelegateName = targetName || 'المندوب';

    // Delete from memory
    memoryDelegates = memoryDelegates.filter(d => d.id !== id);

    // 1. Delete from `delegates` table
    try {
      await adminClient.from('delegates').delete().eq('id', id);
    } catch {}

    // 2. Delete from `profiles` table
    try {
      await adminClient.from('profiles').delete().eq('id', id);
    } catch {}

    // 3. Resolve current authenticated admin
    let currentAdminProfile: any = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ap } = await adminClient
          .from('profiles')
          .select('id, full_name, store_name, role')
          .eq('id', user.id)
          .maybeSingle();
        currentAdminProfile = ap;
      }
    } catch {}

    const adminName = currentAdminProfile?.full_name || currentAdminProfile?.store_name || 'المدير';

    // 4. Log Action to Audit Logs
    await logAction({
      actionType: 'حذف مندوب',
      category: 'المندوبين والمشرفين',
      details: `تم حذف المندوب [${finalDelegateName}] من سجلات المناديب`,
      user: {
        id: currentAdminProfile?.id,
        name: adminName,
        role: 'admin'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف المندوب بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Delegate DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
