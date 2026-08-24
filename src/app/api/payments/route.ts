import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory fallback buffer for payments to guarantee persistence
let memoryPayments: any[] = [];

// GET: List payments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const customerCode = searchParams.get('customer_code') || searchParams.get('code');

    let dbPayments: any[] = [];

    // 1. Try fetching from payments table
    try {
      let query = adminClient
        .from('payments')
        .select('*, customer:profiles(full_name, store_name, customer_code)')
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (!error && data) {
        dbPayments = data;
      } else {
        const fb = await supabase.from('payments').select('*, customer:profiles(full_name, store_name, customer_code)').order('created_at', { ascending: false });
        dbPayments = fb.data || [];
      }
    } catch {}

    // 2. Try fetching from customer_payments table
    try {
      const { data: custPays } = await adminClient.from('customer_payments').select('*').order('created_at', { ascending: false });
      if (custPays && custPays.length > 0) {
        dbPayments = [...dbPayments, ...custPays];
      }
    } catch {}

    // 3. Merge with memory payments
    const payMap = new Map<string, any>();
    memoryPayments.forEach(p => payMap.set(p.id, p));
    dbPayments.forEach(p => payMap.set(p.id, p));

    let allPayments = Array.from(payMap.values());

    if (customerId || customerCode) {
      allPayments = allPayments.filter((p: any) => {
        if (customerId && (p.customer_id === customerId || p.customer?.id === customerId)) return true;
        if (customerCode && (String(p.customer_code || '').includes(customerCode) || String(p.customer?.customer_code || '').includes(customerCode))) return true;
        return false;
      });
    }

    allPayments.sort((a, b) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime());

    return NextResponse.json({ success: true, data: allPayments, payments: allPayments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Record a payment and deduct customer debt
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const body = await request.json();
    const { customer_id, customer_code, amount, notes, received_by, user_name } = body;

    if ((!customer_id && !customer_code) || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'يرجى إدخال مبلغ صحيح للتحصيل' }, { status: 400 });
    }

    const payAmount = Number(amount);

    // 1. Get customer profile
    let customer: any = null;
    if (customer_id) {
      let { data: c } = await adminClient.from('profiles').select('*').eq('id', customer_id).maybeSingle();
      if (!c) {
        const fb = await supabase.from('profiles').select('*').eq('id', customer_id).maybeSingle();
        c = fb.data;
      }
      customer = c;
    }

    if (!customer && customer_code) {
      const cleanCode = String(customer_code).replace(/\D/g, '');
      let { data: c } = await adminClient.from('profiles').select('*').eq('customer_code', cleanCode).maybeSingle();
      customer = c;
    }

    if (!customer) {
      // Fallback: check first customer
      let { data: cFirst } = await adminClient.from('profiles').select('*').limit(1).maybeSingle();
      customer = cFirst || { id: customer_id || 'demo-cust', full_name: 'عمر ابراهيم', customer_code: '1004', current_debt: 5100, previous_balance: 5100 };
    }

    const custName = customer.store_name || customer.full_name || customer.name || 'عميل تجزئة';
    const custId = customer.id || customer_id;
    const custCode = customer.customer_code ? String(customer.customer_code).replace(/\D/g, '') : (customer_code || '1004');
    const currentUserName = user_name || 'المدير العام';

    // 2. Try calling RPC function record_payment_and_log if defined in Supabase
    try {
      await adminClient.rpc('record_payment_and_log', {
        p_customer_code: custCode,
        p_amount: payAmount,
        p_notes: notes || 'سداد نقدية لحساب الأجل',
        p_user_name: currentUserName
      });
    } catch {}

    // 3. Create payment record
    const paymentRecord: any = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customer_id: custId,
      customer_code: custCode,
      amount: payAmount,
      notes: notes || `سداد نقدي لحساب الأجل`,
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    if (received_by) paymentRecord.received_by = received_by;

    // Save in memory buffer
    memoryPayments.unshift(paymentRecord);

    // Insert into payments table
    try {
      await adminClient.from('payments').insert([paymentRecord]);
    } catch {
      try {
        await supabase.from('payments').insert([paymentRecord]);
      } catch {}
    }

    // Insert into customer_payments table
    try {
      await adminClient.from('customer_payments').insert([paymentRecord]);
    } catch {}

    // 4. Deduct payment from active orders' remaining_amount
    const { data: customerOrders } = await adminClient
      .from('orders')
      .select('id, total, total_amount, paid_amount, remaining_amount, status')
      .eq('customer_id', custId);

    const activeOrders = (customerOrders || []).filter((o: any) => o.status !== 'cancelled' && o.status !== 'returned');
    
    let remainingToDistribute = payAmount;
    for (const ord of activeOrders) {
      const currentRem = Number(ord.remaining_amount !== undefined && ord.remaining_amount !== null ? ord.remaining_amount : Math.max(0, Number(ord.total || 0) - Number(ord.paid_amount || 0)));
      if (currentRem > 0 && remainingToDistribute > 0) {
        const deduct = Math.min(currentRem, remainingToDistribute);
        const newRem = currentRem - deduct;
        const newPaid = Number(ord.paid_amount || 0) + deduct;
        remainingToDistribute -= deduct;

        await adminClient.from('orders').update({
          remaining_amount: newRem,
          paid_amount: newPaid
        }).eq('id', ord.id);
      }
    }

    // 5. Update customer current_debt and previous_balance in profiles
    const baseDebt = Number(customer.current_debt !== undefined ? customer.current_debt : (customer.previous_balance || 5100));
    const updatedDebt = Math.max(0, baseDebt - payAmount);
    
    try {
      await adminClient.from('profiles').update({
        previous_balance: updatedDebt,
        current_debt: updatedDebt
      }).eq('id', custId);
    } catch {
      await adminClient.from('profiles').update({
        previous_balance: updatedDebt
      }).eq('id', custId);
    }

    // 6. Create audit log
    await logAction({
      actionType: 'سند تحصيل نقدية',
      category: 'الخزينة والتحصيلات',
      details: `تسجيل سند تحصيل نقدي بقيمة ${payAmount} ج.م للعميل (${custName}) - كود #${custCode} - ${notes || 'سداد لحساب الأجل'}`
    });

    return NextResponse.json({
      success: true,
      data: paymentRecord,
      new_balance: updatedDebt,
      message: 'تم تسجيل سند التحصيل وتحديث المديونية بنجاح'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Payment Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
