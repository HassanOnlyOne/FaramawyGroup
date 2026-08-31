import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const body = await req.json();
    const status: OrderStatus = body.status;

    if (!status) {
      return NextResponse.json({ success: false, error: 'الحالة مطلوب تحديدها' }, { status: 400 });
    }

    // 1. جلب الطلب منفرداً أولاً
    let query = adminClient.from('orders').select('*');
    if (id.startsWith('INV-')) {
      query = query.eq('invoice_no', id);
    } else if (id.startsWith('ORD-')) {
      query = query.eq('order_number', id);
    } else {
      query = query.or(`id.eq.${id},order_number.eq.${id},invoice_no.eq.${id}`);
    }

    const { data: orderList } = await query;
    let order = orderList && orderList[0];

    if (!order) {
      let fbQuery = supabase.from('orders').select('*');
      if (id.startsWith('INV-')) {
        fbQuery = fbQuery.eq('invoice_no', id);
      } else if (id.startsWith('ORD-')) {
        fbQuery = fbQuery.eq('order_number', id);
      } else {
        fbQuery = fbQuery.or(`id.eq.${id},order_number.eq.${id},invoice_no.eq.${id}`);
      }
      const fbRes = await fbQuery;
      order = fbRes.data && fbRes.data[0];
    }

    if (!order) {
      return NextResponse.json({ success: false, error: 'الطلب غير موجود' }, { status: 404 });
    }

    const targetOrderId = order.id;

    // 2. جلب بنود الطلب من جدول order_items مباشرة لضمان عدم التكرار
    const { data: rawItems } = await adminClient
      .from('order_items')
      .select('id, product_id, quantity')
      .eq('order_id', targetOrderId);

    // تجميع كميات الأصناف في Map فريد تماماً
    const uniqueProductQuantities = new Map<string, number>();
    if (rawItems && rawItems.length > 0) {
      // تفادي تكرار السطور بنفس الـ id
      const seenItemIds = new Set<string>();
      for (const item of rawItems) {
        if (!seenItemIds.has(item.id)) {
          seenItemIds.add(item.id);
          const pId = item.product_id;
          const qty = Number(item.quantity) || 0;
          if (pId && qty > 0) {
            uniqueProductQuantities.set(pId, (uniqueProductQuantities.get(pId) || 0) + qty);
          }
        }
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

    // إعادة احتساب مديونية العميل
    if (order.customer_id) {
      const { data: customerOrders } = await adminClient
        .from('orders')
        .select('id, total, total_amount, paid_amount, remaining_amount, payment_method, status')
        .eq('customer_id', order.customer_id);

      if (customerOrders) {
        const totalCustomerDebt = customerOrders
          .filter((o: any) => {
            const ordStatus = o.id === targetOrderId ? status : o.status;
            return !['cancelled', 'returned'].includes(ordStatus);
          })
          .reduce((sum: number, o: any) => {
            const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
            const ordPaid = Number(o.paid_amount || 0);
            const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : Math.max(0, ordTotal - ordPaid));
            return sum + rem;
          }, 0);

        await adminClient.from('profiles').update({
          previous_balance: totalCustomerDebt,
          current_debt: totalCustomerDebt,
          debt_balance: totalCustomerDebt
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

    const rawInvoiceNo = order.invoice_no || order.order_number || targetOrderId;
    const cleanInvoiceNo = String(rawInvoiceNo).replace(/^#+/, '');
    const formattedInvoiceNo = cleanInvoiceNo.startsWith('INV-') 
      ? `#${cleanInvoiceNo}` 
      : `#INV-${cleanInvoiceNo.padStart(6, '0')}`;

    await logAction({
      actionType: 'تحديث حالة طلب',
      category: 'المبيعات والفواتير',
      details: `تم تغيير حالة الفاتورة/الطلب (${formattedInvoiceNo}) للعميل (${customerRealName}) إلى حالة (${statusArabicMap[status] || status})`
    });

    return NextResponse.json({ 
      success: true, 
      data: updatedOrder, 
      message: 'تم تحديث حالة الطلب والمخزون بنجاح' 
    }, { status: 200 });
  } catch (err: any) {
    console.error('Admin Status PATCH error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}