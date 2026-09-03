import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const supplierId = body.supplier_id || body.id;
    const paymentAmount = Number(body.payment_amount || body.amount || 0);
    const notes = body.notes ? String(body.notes).trim() : '';
    const paymentMethod = body.payment_method || 'كاش نقدي';

    if (!supplierId || paymentAmount <= 0) {
      return NextResponse.json({ success: false, error: 'معرف المورد وقيمة الدفعة مطلوبان' }, { status: 400 });
    }

    // 1. جلب بيانات المورد
    let { data: supplier } = await adminClient
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .maybeSingle();

    if (!supplier) {
      const fb = await supabase.from('suppliers').select('*').eq('id', supplierId).maybeSingle();
      supplier = fb.data;
    }

    if (!supplier) {
      return NextResponse.json({ success: false, error: 'المورد غير موجود' }, { status: 404 });
    }

    const currentBal = Number(supplier.current_balance !== undefined && supplier.current_balance !== null ? supplier.current_balance : (supplier.balance || 0));
    const newBalance = Math.max(0, currentBal - paymentAmount);
    const supplierTitle = supplier.company_name || supplier.company || supplier.name || 'مورد';

    // 2. بيانات المستخدم
    const { data: { user: callerUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    let callerName = '';
    let callerRole = '';
    if (callerUser) {
      const { data: callerProf } = await adminClient.from('profiles').select('full_name, role').eq('id', callerUser.id).maybeSingle();
      callerName = callerProf?.full_name || callerUser.email?.split('@')[0] || '';
      callerRole = callerProf?.role || '';
    }

    // 3. إدراج السند في جدول supplier_payments
    const paymentInsertPayload: any = {
      id: crypto.randomUUID(),
      supplier_id: supplierId,
      amount: paymentAmount,
      payment_method: paymentMethod,
      notes: notes || `سداد نقدي لحساب المورد ${supplierTitle}`,
      created_by: callerUser?.id || null,
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    let insertedPayment: any = null;
    let { data: pData, error: payErr } = await adminClient
      .from('supplier_payments')
      .insert([paymentInsertPayload])
      .select()
      .maybeSingle();

    if (payErr) {
      const fallbackPayload = { ...paymentInsertPayload };
      delete fallbackPayload.payment_method;
      delete fallbackPayload.created_by;
      const retry = await adminClient.from('supplier_payments').insert([fallbackPayload]).select().maybeSingle();
      insertedPayment = retry.data;
    } else {
      insertedPayment = pData;
    }

    // 4. تسجيل حركة الخزينة
    const treasuryEntry = {
      id: crypto.randomUUID(),
      transaction_type: 'سداد دفعة مورد',
      inflow: 0,
      outflow: paymentAmount,
      party: supplierTitle,
      party_id: supplierId,
      notes: `سداد نقدي لحساب المورد ${supplierTitle}${notes ? ` (${notes})` : ''}`,
      created_at: new Date().toISOString(),
      created_by: callerUser?.id || null
    };

    try {
      await adminClient.from('treasury_transactions').insert([treasuryEntry]);
    } catch (errTx) {
      console.warn('treasury_transactions insert warning:', errTx);
    }

    // 5. تحديث رصيد المورد بدون المساس بالفواتير الأصلية
    const supUpdates: any = { 
      balance: newBalance, 
      current_balance: newBalance, 
      updated_at: new Date().toISOString() 
    };
    
    const { error: upErr } = await adminClient.from('suppliers').update(supUpdates).eq('id', supplierId);
    if (upErr) {
      await adminClient.from('suppliers').update({ balance: newBalance, current_balance: newBalance }).eq('id', supplierId);
    }

    // 6. تسجيل العملية في سجل التدقيق
    await logAction({
      actionType: 'سداد دفعة للمورد',
      category: 'الخزينة والتحصيلات',
      details: `قام ${callerName || 'المشرف'} بسداد دفعة نقدية بقيمة ${paymentAmount} ج.م للمورد (${supplierTitle}) - الرصيد الجديد: ${newBalance} ج.م`,
      user: { id: callerUser?.id, name: callerName, role: callerRole }
    });

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      payment: insertedPayment || paymentInsertPayload,
      message: 'تم تسجيل سداد الدفعة وحفظ سند الصرف بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Supplier Pay error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}