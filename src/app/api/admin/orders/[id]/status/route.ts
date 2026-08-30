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

    // Query order flexibly by id, order_number, or invoice_no
    let query = adminClient.from('orders').select('*, order_items(*)');
    if (id.startsWith('INV-')) {
      query = query.eq('invoice_no', id);
    } else if (id.startsWith('ORD-')) {
      query = query.eq('order_number', id);
    } else {
      query = query.or(`id.eq.${id},order_number.eq.${id},invoice_no.eq.${id}`);
    }

    let { data: orderList } = await query;
    let order = orderList && orderList[0];

    if (!order) {
      let fbQuery = supabase.from('orders').select('*, order_items(*)');
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
    
    // 1. Stock Deduction Safeguard Logic
    const isCurrentlyDeducted = Boolean(order.stock_deducted);
    const isNowCompleted = status === 'completed';
    const isCancelledOrReturned = status === 'cancelled' || status === 'returned';

    let willBeDeducted = isCurrentlyDeducted;

    // A. When status becomes 'completed':
    // If stock_deducted === true in DB, skip deduction immediately.
    // If stock_deducted === false, deduct exact item quantities once (1:1), then set stock_deducted = true.
    if (isNowCompleted && !isCurrentlyDeducted) {
      try {
        const { data: rpcRes, error: rpcErr } = await adminClient.rpc('complete_order_and_deduct_stock', {
          p_order_id: targetOrderId
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          willBeDeducted = true;
        } else {
          // Fallback 1:1 JS deduction if RPC function is not created in DB instance yet
          if (Array.isArray(order.order_items) && order.order_items.length > 0) {
            const qtyByProduct = new Map<string, number>();
            for (const item of order.order_items) {
              const prodId = item.product_id || item.product?.id;
              const qty = Number(item.quantity || 0);
              if (prodId && qty > 0) {
                qtyByProduct.set(prodId, (qtyByProduct.get(prodId) || 0) + qty);
              }
            }

            for (const [prodId, totalQty] of qtyByProduct.entries()) {
              const { data: product } = await adminClient
                .from('products')
                .select('stock_quantity')
                .eq('id', prodId)
                .maybeSingle();

              if (product) {
                const currentStock = Number(product.stock_quantity || 0);
                const newStock = Math.max(0, currentStock - totalQty);
                await adminClient
                  .from('products')
                  .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
                  .eq('id', prodId);
              }
            }
          }
          willBeDeducted = true;
        }
      } catch (e) {
        console.warn('RPC complete_order_and_deduct_stock exception:', e);
        willBeDeducted = true;
      }
    }

    // B. When order is cancelled or returned after being completed:
    // If stock_deducted === true, restore quantities once (+ item.quantity), then set stock_deducted = false.
    if ((isCancelledOrReturned || (!isNowCompleted && isCurrentlyDeducted)) && isCurrentlyDeducted) {
      try {
        const { data: rpcRes, error: rpcErr } = await adminClient.rpc('restore_order_stock', {
          p_order_id: targetOrderId
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          willBeDeducted = false;
        } else {
          if (Array.isArray(order.order_items) && order.order_items.length > 0) {
            const qtyByProduct = new Map<string, number>();
            for (const item of order.order_items) {
              const prodId = item.product_id || item.product?.id;
              const qty = Number(item.quantity || 0);
              if (prodId && qty > 0) {
                qtyByProduct.set(prodId, (qtyByProduct.get(prodId) || 0) + qty);
              }
            }

            for (const [prodId, totalQty] of qtyByProduct.entries()) {
              const { data: product } = await adminClient
                .from('products')
                .select('stock_quantity')
                .eq('id', prodId)
                .maybeSingle();

              if (product) {
                const currentStock = Number(product.stock_quantity || 0);
                const newStock = currentStock + totalQty;
                await adminClient
                  .from('products')
                  .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
                  .eq('id', prodId);
              }
            }
          }
          willBeDeducted = false;
        }
      } catch (e) {
        console.warn('RPC restore_order_stock exception:', e);
        willBeDeducted = false;
      }
    }

    // Update order status AND stock_deducted in database
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

    // Fallback if stock_deducted column is missing in table schema
    if (updateError && updateError.message.includes('stock_deducted')) {
      delete orderUpdatePayload.stock_deducted;
      const retry = await adminClient
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', targetOrderId)
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .maybeSingle();
      updatedOrder = retry.data;
      updateError = retry.error;
    }

    if (updateError || !updatedOrder) {
      const { data: fbUpdated } = await supabase
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', targetOrderId)
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .maybeSingle();
      updatedOrder = fbUpdated || { ...order, status, stock_deducted: willBeDeducted };
    }

    // Recalculate customer debt automatically
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

        await adminClient.from('profiles').update({ previous_balance: totalCustomerDebt }).eq('id', order.customer_id);
      }
    }

    // Arabic translation map for order status
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

    const statusArabic = statusArabicMap[status] || status;

    // Fetch real customer name from order or profile
    let customerRealName = 
      order.customer?.full_name || 
      order.customer?.store_name || 
      order.store_name_ref || 
      order.customer_name || 
      '';

    if (!customerRealName && order.customer_id) {
      const { data: prof } = await adminClient.from('profiles').select('full_name, store_name').eq('id', order.customer_id).maybeSingle();
      if (prof) {
        customerRealName = prof.full_name || prof.store_name || '';
      }
    }

    if (!customerRealName) {
      customerRealName = 'عميل المتجر';
    }

    const rawInvoiceNo = order.invoice_no || order.order_number || targetOrderId;
    const cleanInvoiceNo = String(rawInvoiceNo).replace(/^#+/, '');
    const formattedInvoiceNo = cleanInvoiceNo.startsWith('INV-') 
      ? `#${cleanInvoiceNo}` 
      : `#INV-${cleanInvoiceNo.padStart(6, '0')}`;

    // Log the order status change in audit_logs
    await logAction({
      actionType: 'تحديث حالة طلب',
      category: 'المبيعات والفواتير',
      details: `تم تغيير حالة الفاتورة/الطلب (${formattedInvoiceNo}) للعميل (${customerRealName}) إلى حالة (${statusArabic})`
    });

    return NextResponse.json({ 
      success: true, 
      data: updatedOrder, 
      order: updatedOrder, 
      message: 'تم تحديث حالة الطلب والمخزون بنجاح' 
    }, { status: 200 });
  } catch (err: any) {
    console.error('Admin Status PATCH error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
