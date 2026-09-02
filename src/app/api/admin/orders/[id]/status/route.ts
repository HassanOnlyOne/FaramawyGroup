import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminClient = createAdminClient();
    const { id: targetOrderId } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'حالة الطلب مطلوبة' }, { status: 400 });
    }

    // جلب الطلب وعناصره
    const { data: order, error: orderFetchError } = await adminClient
      .from('orders')
      .select('*, order_items(*, product:products(*))')
      .eq('id', targetOrderId)
      .maybeSingle();

    if (orderFetchError || !order) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    // تجميع كميات الأصناف الفعلية
    const uniqueProductQuantities = new Map<string, number>();
    const items = order.order_items || [];

    for (const item of items) {
      const prodId = item.product_id || item.product?.id;
      const qty = Number(item.quantity) || 0;
      if (prodId && qty > 0) {
        uniqueProductQuantities.set(prodId, (uniqueProductQuantities.get(prodId) || 0) + qty);
      }
    }

    const isCurrentlyDeducted = Boolean(order.stock_deducted);
    const isNowCompleted = status === 'completed';
    const isCancelledOrReturned = status === 'cancelled' || status === 'returned';

    let willBeDeducted = isCurrentlyDeducted;

    // الخصم عند اكتمال الطلب (مرة واحدة فقط وبكميات فريدة)
    if (isNowCompleted && !isCurrentlyDeducted) {
      for (const [prodId, totalQty] of uniqueProductQuantities.entries()) {
        const { data: product } = await adminClient
          .from('products')
          .select('stock_quantity')
          .eq('id', prodId)
          .maybeSingle();

        if (product) {
          const currentStock = Number(product.stock_quantity) || 0;
          const newStock = Math.max(0, currentStock - totalQty);
          await adminClient
            .from('products')
            .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
            .eq('id', prodId);
        }
      }
      willBeDeducted = true;
    }

    // إعادة المخزون عند الإلغاء
    if (isCancelledOrReturned && isCurrentlyDeducted) {
      for (const [prodId, totalQty] of uniqueProductQuantities.entries()) {
        const { data: product } = await adminClient
          .from('products')
          .select('stock_quantity')
          .eq('id', prodId)
          .maybeSingle();

        if (product) {
          const currentStock = Number(product.stock_quantity) || 0;
          const newStock = currentStock + totalQty;
          await adminClient
            .from('products')
            .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
            .eq('id', prodId);
        }
      }
      willBeDeducted = false;
    }

    // تحديث الطلب
    const orderUpdatePayload: any = { 
      status, 
      stock_deducted: willBeDeducted,
      updated_at: new Date().toISOString() 
    };

    let { data: updatedOrder, error: updateError } = await adminClient
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', targetOrderId)
      .select('*, order_items(*, product:products(*)), customer:profiles(*)')
      .maybeSingle();

    if (updateError && updateError.message.includes('stock_deducted')) {
      delete orderUpdatePayload.stock_deducted;
      const retry = await adminClient
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', targetOrderId)
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .maybeSingle();
      updatedOrder = retry.data;
    }

    if (!updatedOrder) {
      updatedOrder = { ...order, status, stock_deducted: willBeDeducted };
    }

    // إعادة احتساب مديونية العميل بدقة: مجموع المتبقي من فواتير الآجل غير الملغية وغير المعلقة فقط - مجموع التحصيلات
    if (order.customer_id) {
      const [ordRes, payRes] = await Promise.all([
        adminClient
          .from('orders')
          .select('id, total, total_amount, paid_amount, remaining_amount, payment_method, status')
          .eq('customer_id', order.customer_id),
        adminClient
          .from('customer_payments')
          .select('amount')
          .eq('customer_id', order.customer_id)
      ]);

      const customerOrders = ordRes.data || [];
      const customerPayments = payRes.data || [];
      const totalPaymentsSum = customerPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      const totalCreditOrdersDebt = customerOrders
        .filter((o: any) => {
          const ordStatus = o.id === targetOrderId ? status : o.status;
          return !['pending', 'cancelled', 'returned'].includes(ordStatus);
        })
        .reduce((sum: number, o: any) => {
          const isCredit = o.payment_method === 'credit';
          const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
          const ordPaid = Number(o.paid_amount || 0);
          const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
          
          if (!isCredit && rem <= 0) return sum;
          return sum + rem;
        }, 0);

      const netDebt = Math.max(0, totalCreditOrdersDebt - totalPaymentsSum);

      try {
        await adminClient.from('profiles').update({
          previous_balance: netDebt,
          current_debt: netDebt,
          debt_balance: netDebt
        }).eq('id', order.customer_id);
      } catch {
        await adminClient.from('profiles').update({
          previous_balance: netDebt
        }).eq('id', order.customer_id);
      }
    }

    // توثيق العملية في سجل العمليات
    const statusArabicMap: Record<string, string> = {
      pending: 'قيد الانتظار',
      processing: 'تمت الموافقة والتجهيز',
      approved: 'تمت الموافقة والتجهيز',
      out_for_delivery: 'جاري التوصيل',
      shipping: 'جاري التوصيل',
      completed: 'مكتمل ومستلم',
      cancelled: 'ملغي',
      modified_by_owner: 'تم التعديل',
      returned: 'مرتجع',
    };

    let customerRealName = order.customer_name || 'عميل المتجر';
    if (order.customer_id) {
      const { data: prof } = await adminClient.from('profiles').select('full_name, store_name').eq('id', order.customer_id).maybeSingle();
      if (prof) customerRealName = prof.full_name || prof.store_name || customerRealName;
    }

    const orderNumberStr = order.invoice_no || order.order_number || targetOrderId;

    await logAction({
      actionType: 'تحديث حالة طلب',
      category: 'المبيعات والفواتير',
      details: `تم تغيير حالة طلب الفاتورة #${orderNumberStr} للعميل (${customerRealName}) إلى [${statusArabicMap[status] || status}]${willBeDeducted && !isCurrentlyDeducted ? ' وتم خصم المخزون بنجاح' : ''}`,
      user: { id: 'admin', name: 'المدير العام', role: 'admin' }
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      stockDeducted: willBeDeducted,
      message: `تم تحديث حالة الطلب إلى ${statusArabicMap[status] || status} بنجاح`
    });

  } catch (error: any) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: error.message || 'فشل تحديث حالة الطلب' }, { status: 500 });
  }
}