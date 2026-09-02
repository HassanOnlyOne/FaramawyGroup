import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

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

// GET: List all customers/users with balances
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    let query = adminClient.from('profiles').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,store_name.ilike.%${search}%,customer_code.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    let { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    
    if (error || !data) {
      let fbQuery = supabase.from('profiles').select('*', { count: 'exact' });
      if (search) {
        fbQuery = fbQuery.or(`full_name.ilike.%${search}%,store_name.ilike.%${search}%,customer_code.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const res = await fbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      data = res.data;
      count = res.count;
    }

    const safeList = Array.isArray(data) ? data : [];

    // Fetch active orders and payments to calculate accurate unified debt
    const [ordRes, payRes] = await Promise.all([
      adminClient.from('orders').select('id, customer_id, total, total_amount, paid_amount, remaining_amount, payment_method, status'),
      adminClient.from('customer_payments').select('id, customer_id, amount')
    ]);

    const allOrders = ordRes.data || [];
    const allPayments = payRes.data || [];

    // Ensure customer_code is clean numeric and attach accurate current_debt
    const formattedList = safeList.map((c: any, index: number) => {
      const cleanCode = c.customer_code ? String(c.customer_code).replace(/\D/g, '') : '';
      
      const custOrders = allOrders.filter((o: any) => o.customer_id === c.id);
      const custPayments = allPayments.filter((p: any) => p.customer_id === c.id);
      const totalPaymentsSum = custPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      const totalApprovedCreditDebt = custOrders
        .filter((o: any) => !['pending', 'cancelled', 'returned'].includes(o.status))
        .reduce((sum: number, o: any) => {
          const isCredit = o.payment_method === 'credit';
          const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
          const ordPaid = Number(o.paid_amount || 0);
          const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
          if (!isCredit && rem <= 0) return sum;
          return sum + rem;
        }, 0);

      const netDebt = totalApprovedCreditDebt > 0 
        ? Math.max(0, totalApprovedCreditDebt - totalPaymentsSum) 
        : (custPayments.length > 0 ? 0 : Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0)));

      return {
        ...c,
        customer_code: cleanCode || String(1000 + index),
        current_debt: netDebt,
        previous_balance: netDebt
      };
    });

    return NextResponse.json({ data: formattedList, customers: formattedList, total: count || formattedList.length, page, limit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update customer credit info, credit status, and roles
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const body = await request.json();
    const targetId = body.id || body.customer_id;
    const updatesObj = body.updates || body;

    if (!targetId) return NextResponse.json({ error: 'معرف العميل مطلوب' }, { status: 400 });

    const updates: any = {};
    if (updatesObj.credit_limit !== undefined) updates.credit_limit = Number(updatesObj.credit_limit);
    if (updatesObj.previous_balance !== undefined) updates.previous_balance = Number(updatesObj.previous_balance);
    if (updatesObj.customer_code !== undefined) updates.customer_code = String(updatesObj.customer_code).replace(/\D/g, '');
    if (updatesObj.store_name !== undefined) updates.store_name = updatesObj.store_name;
    if (updatesObj.full_name !== undefined) updates.full_name = updatesObj.full_name;
    if (updatesObj.is_credit_enabled !== undefined) {
      updates.is_credit_enabled = Boolean(updatesObj.is_credit_enabled);
      updates.credit_enabled = Boolean(updatesObj.is_credit_enabled);
    } else if (updatesObj.credit_enabled !== undefined) {
      updates.is_credit_enabled = Boolean(updatesObj.credit_enabled);
      updates.credit_enabled = Boolean(updatesObj.credit_enabled);
    }
    if (updatesObj.role !== undefined) updates.role = updatesObj.role;

    let { data, error } = await adminClient.from('profiles').update(updates).eq('id', targetId).select().maybeSingle();
    
    // Fallback if schema cache complains about credit_enabled/is_credit_enabled
    if (error && (error.message.includes('credit_enabled') || error.message.includes('is_credit_enabled') || error.code === 'PGRST204')) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.is_credit_enabled;
      delete fallbackUpdates.credit_enabled;
      if (updatesObj.is_credit_enabled !== undefined || updatesObj.credit_enabled !== undefined) {
        fallbackUpdates.credit_enabled = Boolean(updatesObj.is_credit_enabled ?? updatesObj.credit_enabled);
      }
      let retry = await adminClient.from('profiles').update(fallbackUpdates).eq('id', targetId).select().maybeSingle();
      if (retry.error) {
        delete fallbackUpdates.credit_enabled;
        fallbackUpdates.is_credit_enabled = Boolean(updatesObj.is_credit_enabled ?? updatesObj.credit_enabled);
        retry = await adminClient.from('profiles').update(fallbackUpdates).eq('id', targetId).select().maybeSingle();
      }
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      const res = await supabase.from('profiles').update(updates).eq('id', targetId).select().maybeSingle();
      data = res.data;
      if (res.error) throw res.error;
    }

    return NextResponse.json({ data, message: 'تم تحديث بيانات العميل بنجاح' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create or link a customer profile
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const body = await request.json();
    const { full_name, store_name, phone, email, customer_code, credit_limit, previous_balance, credit_enabled, role } = body;

    if (!full_name && !store_name && !phone && !email) {
      return NextResponse.json({ error: 'بيانات العميل (اسم، رقم هاتف، أو بريد) مطلوبة' }, { status: 400 });
    }

    const generatedCode = customer_code && String(customer_code).trim()
      ? String(customer_code).replace(/\D/g, '') || await getNextCustomerCode(adminClient, supabase)
      : await getNextCustomerCode(adminClient, supabase);

    // Check if a profile already exists by email or phone
    let query = adminClient.from('profiles').select('*');
    if (email && phone) {
      query = query.or(`email.eq.${email},phone.eq.${phone}`);
    } else if (email) {
      query = query.eq('email', email);
    } else if (phone) {
      query = query.eq('phone', phone);
    } else {
      query = query.eq('customer_code', generatedCode);
    }

    const { data: existingList } = await query;
    const existingProfile = existingList && existingList[0];

    if (existingProfile) {
      const updates: any = {
        customer_code: generatedCode,
        store_name: store_name || existingProfile.store_name || full_name,
        full_name: full_name || existingProfile.full_name || store_name,
        credit_limit: credit_limit !== undefined ? Number(credit_limit) : existingProfile.credit_limit,
        previous_balance: previous_balance !== undefined ? Number(previous_balance) : existingProfile.previous_balance,
        credit_enabled: credit_enabled !== undefined ? Boolean(credit_enabled) : existingProfile.credit_enabled,
        role: role || existingProfile.role || 'customer'
      };

      let { data: updated, error: updateError } = await adminClient
        .from('profiles')
        .update(updates)
        .eq('id', existingProfile.id)
        .select()
        .maybeSingle();

      if (updateError && (updateError.message.includes('credit_enabled') || updateError.code === 'PGRST204')) {
        delete updates.credit_enabled;
        const retry = await adminClient.from('profiles').update(updates).eq('id', existingProfile.id).select().maybeSingle();
        updated = retry.data;
        updateError = retry.error;
      }

      if (updateError) throw updateError;
      return NextResponse.json({ data: updated, message: 'تم ربط وتحديث الحساب بنجاح' }, { status: 200 });
    }

    // Insert new profile
    const newProfile: any = {
      id: crypto.randomUUID(),
      full_name: full_name || store_name,
      store_name: store_name || full_name,
      phone: phone || null,
      email: email || `${generatedCode}@elfarmawy.com`,
      customer_code: generatedCode,
      credit_limit: credit_limit !== undefined ? Number(credit_limit) : 50000,
      previous_balance: previous_balance !== undefined ? Number(previous_balance) : 0,
      credit_enabled: credit_enabled !== undefined ? Boolean(credit_enabled) : true,
      role: role || 'customer',
      created_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('profiles').insert(newProfile).select().maybeSingle();
    
    if (error && (error.message.includes('credit_enabled') || error.code === 'PGRST204')) {
      delete newProfile.credit_enabled;
      const retry = await adminClient.from('profiles').insert(newProfile).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      delete newProfile.credit_enabled;
      const fbRes = await supabase.from('profiles').insert(newProfile).select().maybeSingle();
      if (fbRes.error) throw fbRes.error;
      data = fbRes.data;
    }

    return NextResponse.json({ data, message: 'تم إنشاء العميل بنجاح', customer_code: generatedCode }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
