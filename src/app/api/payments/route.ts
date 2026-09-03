import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const customerCode = searchParams.get('customer_code') || searchParams.get('code');

    let query = adminClient
      .from('customer_payments')
      .select('*, customer:profiles(full_name, store_name, customer_code)')
      .order('created_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let allPayments = data || [];
    if (customerCode) {
      allPayments = allPayments.filter((p: any) => 
        String(p.customer_code || '').includes(customerCode) || 
        String(p.customer?.customer_code || '').includes(customerCode)
      );
    }

    return NextResponse.json({ success: true, data: allPayments, payments: allPayments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const body = await request.json();
    const { 
      customer_id, 
      customer_code, 
      amount, 
      notes, 
      payment_method = 'cash', 
      user_name 
    } = body;

    if ((!customer_id && !customer_code) || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'يرجى إدخال مبلغ صحيح للتحصيل' }, { status: 400 });
    }

    const payAmount = Number(amount);

    // 1. تحديد بيانات العميل المستهدف
    let customer: any = null;
    if (customer_id) {
      const { data: c } = await adminClient.from('profiles').select('*').eq('id', customer_id).maybeSingle();
      customer = c;
    }

    if (!customer && customer_code) {
      const cleanCode = String(customer_code).replace(/\D/g, '');
      const { data: c } = await adminClient.from('profiles').select('*').eq('customer_code', cleanCode).maybeSingle();
      customer = c;
    }

    if (!customer) {
      return NextResponse.json({ error: 'لم يتم العثور على بيانات العميل' }, { status: 404 });
    }

    const custName = customer.store_name || customer.full_name || customer.name || 'عميل تجزئة';
    const custId = customer.id;
    const custCode = customer.customer_code ? String(customer.customer_code).replace(/\D/g, '') : '1000';
    const nowIso = new Date().toISOString();

    // 2. تجهيز سجل السند
    const paymentRecord = {
      id: crypto.randomUUID(),
      customer_id: custId,
      customer_code: custCode,
      amount: payAmount,
      payment_method: payment_method || 'cash',
      notes: notes || 'سداد نقدي لحساب الأجل',
      payment_date: nowIso,
      created_at: nowIso
    };

    // 3. حفظ السند في جدول customer_payments
    const { error: insertError } = await adminClient.from('customer_payments').insert([paymentRecord]);
    if (insertError) {
      throw new Error('فشل حفظ السند: ' + insertError.message);
    }

    // 4. الحساب الديناميكي الموحد للمديونية من واقع الحركات لتجنب التضارب
    const [{ data: clientOrders }, { data: clientPayments }] = await Promise.all([
      adminClient.from('orders').select('total, total_amount, paid_amount, remaining_amount, payment_method, status').eq('customer_id', custId),
      adminClient.from('customer_payments').select('amount').eq('customer_id', custId)
    ]);

    const totalDebit = (clientOrders || []).reduce((acc: number, o: any) => {
      if (['pending', 'cancelled', 'returned'].includes(o.status)) return acc;
      const isCredit = o.payment_method === 'credit';
      const tot = Number(o.total ?? o.total_amount ?? 0);
      const paid = Number(o.paid_amount || 0);
      const rem = Number(o.remaining_amount ?? (isCredit ? Math.max(0, tot - paid) : 0));
      return acc + (rem > 0 ? rem : (isCredit ? tot : 0));
    }, 0);

    const totalCredit = (clientPayments || []).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
    const updatedDebt = Math.max(0, totalDebit - totalCredit);

    // 5. تحديث جدول profiles بالأعمدة الموجودة فعلياً فقط دون debt_balance
    const { error: updateError } = await adminClient.from('profiles').update({
      current_debt: updatedDebt,
      previous_balance: updatedDebt
    }).eq('id', custId);

    if (updateError) {
      throw new Error('فشل تحديث رصيد العميل: ' + updateError.message);
    }

    // 6. تسجيل العملية في سجل التدقيق
    let currentAdminUser: any = null;
    let currentAdminProfile: any = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      currentAdminUser = authData?.user;
      if (currentAdminUser) {
        const { data: ap } = await adminClient
          .from('profiles')
          .select('id, full_name, store_name, role, email')
          .eq('id', currentAdminUser.id)
          .maybeSingle();
        currentAdminProfile = ap;
      }
    } catch {}

    const adminActualName = currentAdminProfile?.full_name || currentAdminProfile?.store_name || user_name || (currentAdminUser?.email ? currentAdminUser.email.split('@')[0] : 'مدير النظام');
    const adminRole = currentAdminProfile?.role || 'admin';

    await logAction({
      actionType: 'سند تحصيل نقدية',
      category: 'الخزينة والتحصيلات',
      details: `تسجيل سند تحصيل نقدي بمبلغ ${payAmount} ج.م للعميل (${custName}) - كود #${custCode} - المتبقي: ${updatedDebt} ج.م`,
      user: {
        id: currentAdminUser?.id,
        name: adminActualName,
        role: adminRole
      }
    });

    return NextResponse.json({
      success: true,
      data: paymentRecord,
      new_balance: updatedDebt,
      current_debt: updatedDebt,
      message: 'تم تسجيل سند التحصيل وتحديث مديونية العميل بنجاح'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Payment Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}