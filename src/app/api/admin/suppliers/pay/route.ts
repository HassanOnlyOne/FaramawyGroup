import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();

    const body = await req.json().catch(() => ({}));
    const supplierId = body.supplier_id || body.id;
    const paymentAmount = Number(body.payment_amount || body.amount || 0);
    const notes = body.notes ? String(body.notes).trim() : '';
    const paymentMethod = body.payment_method || 'كاش نقدي';

    if (!supplierId || paymentAmount <= 0) {
      return NextResponse.json({ success: false, error: 'معرف المورد وقيمة الدفعة مطلوبان' }, { status: 400 });
    }

    // 1. جلب المورد
    const { data: supplier, error: supErr } = await adminClient
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .maybeSingle();

    if (supErr || !supplier) {
      return NextResponse.json({ success: false, error: 'المورد غير موجود' }, { status: 404 });
    }

    const supplierTitle = supplier.company_name || supplier.company || supplier.name || 'مورد';

    // 2. إدراج السند في جدول supplier_payments
    const paymentRecord = {
      supplier_id: supplierId,
      amount: paymentAmount,
      payment_method: paymentMethod,
      notes: notes || `سداد نقدي لحساب المورد ${supplierTitle}`,
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: insertedPayment, error: insertError } = await adminClient
      .from('supplier_payments')
      .insert([paymentRecord])
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('Insert payment error:', insertError);
      return NextResponse.json({ success: false, error: 'فشل حفظ السند: ' + insertError.message }, { status: 500 });
    }

    // 3. إعادة حساب الرصيد التراكمي الموحد وتحديث جدول suppliers
    const opening = Number(supplier.opening_balance ?? supplier.initial_balance ?? 0);

    const [{ data: supPurchases }, { data: supPayments }] = await Promise.all([
      adminClient.from('purchases').select('total, total_amount, paid_amount, remaining_amount').eq('supplier_id', supplierId),
      adminClient.from('supplier_payments').select('amount').eq('supplier_id', supplierId)
    ]);

    const purchasesDebt = (supPurchases || []).reduce((sum: number, p: any) => {
      const tot = Number(p.total ?? p.total_amount ?? 0);
      const pd = Number(p.paid_amount ?? 0);
      const rem = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, tot - pd));
      return sum + rem;
    }, 0);

    const totalPaid = (supPayments || []).reduce((sum: number, pay: any) => sum + Number(pay.amount || 0), 0);
    const finalBalance = Math.max(0, (opening + purchasesDebt) - totalPaid);

    await adminClient
      .from('suppliers')
      .update({
        balance: finalBalance,
        current_balance: finalBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierId);

    // 4. تسجيل في سجل التدقيق
    try {
      await logAction({
        actionType: 'سداد دفعة للمورد',
        category: 'الخزينة والتحصيلات',
        details: `تسجيل سند صرف نقدي بقيمة ${paymentAmount} ج.م للمورد (${supplierTitle}) - الرصيد المتبقي: ${finalBalance} ج.م`
      });
    } catch {}

    return NextResponse.json({
      success: true,
      new_balance: finalBalance,
      payment: insertedPayment || paymentRecord,
      message: 'تم تسجيل السند وتحديث الرصيد بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Supplier Pay error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}