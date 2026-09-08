import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

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

    // 1. Fetch order by ID, invoice_no, or order_number
    let { data: order } = await adminClient
      .from('orders')
      .select('*, order_items(*, product:products(*))')
      .eq('id', targetOrderId)
      .maybeSingle();

    if (!order) {
      const { data: byInv } = await adminClient
        .from('orders')
        .select('*, order_items(*, product:products(*))')
        .eq('invoice_no', targetOrderId)
        .maybeSingle();
      order = byInv;
    }

    if (!order) {
      const { data: byOrd } = await adminClient
        .from('orders')
        .select('*, order_items(*, product:products(*))')
        .eq('order_number', targetOrderId)
        .maybeSingle();
      order = byOrd;
    }

    if (!order) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    const actualOrderId = order.id;

    // 2. Calculate unique product quantities for inventory adjustment
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

    // Deduct stock on completed
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

    // Restore stock on cancelled or returned
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

    // 3. Update orders row
    const orderUpdatePayload: any = { 
      status, 
      stock_deducted: willBeDeducted,
      updated_at: new Date().toISOString() 
    };

    let { data: updatedOrder, error: updateError } = await adminClient
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', actualOrderId)
      .select('*, order_items(*, product:products(*)), customer:profiles(*)')
      .maybeSingle();

    if (updateError && updateError.message?.includes('stock_deducted')) {
      delete orderUpdatePayload.stock_deducted;
      const retry = await adminClient
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', actualOrderId)
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .maybeSingle();
      updatedOrder = retry.data;
    }

    if (!updatedOrder) {
      updatedOrder = { ...order, status, stock_deducted: willBeDeducted };
    }

    // 4. Handle Credit Surplus Cash Payment & Reversal (Rollback)
    const targetCustomerId = order.customer_id;
    if (targetCustomerId) {
      const orderMethod = order.payment_method;
      const isCredit = orderMethod === 'credit' || orderMethod === 'آجل';
      const orderPaid = Number(order.paid_amount || 0);
      const orderTotal = Number(order.total !== undefined && order.total !== null ? order.total : (order.total_amount || 0));
      const surplus = Math.max(0, orderPaid - orderTotal);
      const orderRefStr = order.invoice_no || order.order_number || actualOrderId;

      if (isNowCompleted) {
        // --- CASE 1: Status changed TO completed ---
        if (isCredit && surplus > 0) {
          // Check if surplus payment voucher was already created (Idempotency)
          const { data: existingSurplusList } = await adminClient
            .from('customer_payments')
            .select('id')
            .eq('customer_id', targetCustomerId)
            .ilike('notes', `%${orderRefStr}%`);

          if (!existingSurplusList || existingSurplusList.length === 0) {
            const recNum = `REC-${Date.now().toString().slice(-6)}`;
            const surplusPayload: any = {
              id: crypto.randomUUID(),
              customer_id: targetCustomerId,
              customer_code: order.customer_code,
              amount: surplus,
              receipt_number: recNum,
              payment_method: 'cash',
              notes: `سداد مديونية سابقة من مقدم طلب الفاتورة #${orderRefStr}`,
              payment_date: new Date().toISOString(),
              created_at: new Date().toISOString()
            };

            const { error: insErr } = await adminClient
              .from('customer_payments')
              .insert([surplusPayload]);

            if (insErr) {
              delete surplusPayload.receipt_number;
              await adminClient.from('customer_payments').insert([surplusPayload]);
            }

            try {
              await adminClient.from('payments').insert([surplusPayload]);
            } catch {}

            // Audit log for surplus debt payment
            await logAction({
              actionType: 'سداد مديونية سابقة',
              category: 'الخزينة والتحصيلات',
              details: `خصم ${surplus} ج.م من المديونية السابقة للعميل كفائض مسدد من مقدم طلب الفاتورة #${orderRefStr}`,
              user: { id: targetCustomerId, name: order.customer_name || 'العميل', role: 'customer' }
            });
          }
        }
      } else {
        // --- CASE 2: Status changed FROM completed to any non-completed status (Rollback / Reversal) ---
        const { data: existingSurplusList } = await adminClient
          .from('customer_payments')
          .select('id, amount, receipt_number')
          .eq('customer_id', targetCustomerId)
          .ilike('notes', `%${orderRefStr}%`);

        if (existingSurplusList && existingSurplusList.length > 0) {
          for (const sPay of existingSurplusList) {
            await adminClient.from('customer_payments').delete().eq('id', sPay.id);
            try {
              await adminClient.from('payments').delete().eq('id', sPay.id);
            } catch {}
          }

          // Audit log for reversal
          await logAction({
            actionType: 'إلغاء سند سداد مديونية',
            category: 'الخزينة والتحصيلات',
            details: `إلغاء سند سداد مديونية سابقة للفاتورة #${orderRefStr} وإعادة الرصيد للعميل بسبب تغيير حالة الطلب إلى (${status})`,
            user: { id: targetCustomerId, name: order.customer_name || 'العميل', role: 'customer' }
          });
        }
      }

      // Automatically recalculate and update customer current_debt in profiles table
      const [ordRes, payRes] = await Promise.all([
        adminClient
          .from('orders')
          .select('id, total, total_amount, paid_amount, remaining_amount, payment_method, status')
          .eq('customer_id', targetCustomerId),
        adminClient
          .from('customer_payments')
          .select('amount')
          .eq('customer_id', targetCustomerId)
      ]);

      const customerOrders = ordRes.data || [];
      const customerPayments = payRes.data || [];
      const totalPaymentsSum = customerPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      const totalCreditOrdersDebt = customerOrders
        .filter((o: any) => {
          const ordStatus = o.id === actualOrderId ? status : o.status;
          return !['pending', 'cancelled', 'returned'].includes(ordStatus) && (o.payment_method === 'credit' || o.payment_method === 'آجل');
        })
        .reduce((sum: number, o: any) => {
          const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
          const ordPaid = Number(o.paid_amount || 0);
          const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : Math.max(0, ordTotal - ordPaid));
          return sum + rem;
        }, 0);

      const netDebt = Math.max(0, totalCreditOrdersDebt - totalPaymentsSum);

      try {
        await adminClient.from('profiles').update({
          previous_balance: netDebt,
          current_debt: netDebt
        }).eq('id', targetCustomerId);
      } catch (errProf) {
        console.error('Error updating profile debt:', errProf);
      }
    }

    // 5. Audit Logging
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
    let customerRole = 'customer';
    if (order.customer_id) {
      const { data: prof } = await adminClient.from('profiles').select('full_name, store_name, role').eq('id', order.customer_id).maybeSingle();
      if (prof) {
        customerRealName = prof.full_name || prof.store_name || customerRealName;
        customerRole = prof.role || customerRole;
      }
    }

    const orderNumberStr = order.invoice_no || order.order_number || actualOrderId;

    await logAction({
      actionType: status === 'cancelled' ? 'إلغاء طلب توريد' : 'تحديث حالة طلب',
      category: 'المبيعات والفواتير',
      details: `تم تغيير حالة طلب الفاتورة #${orderNumberStr} للعميل (${customerRealName}) إلى [${statusArabicMap[status] || status}]${willBeDeducted && !isCurrentlyDeducted ? ' وتم خصم المخزون بنجاح' : ''}`,
      user: { id: order.customer_id, name: customerRealName, role: customerRole }
    });

    try {
      revalidatePath('/admin/orders');
      revalidatePath('/admin/orders/[id]');
      revalidatePath(`/admin/orders/${actualOrderId}`);
      revalidatePath('/admin/customers');
      if (targetCustomerId) {
        revalidatePath(`/admin/customers/${targetCustomerId}`);
      }
    } catch {}

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