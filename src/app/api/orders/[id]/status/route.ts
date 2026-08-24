import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
    const currentStatus = order.status;

    // Deduct stock strictly when status becomes 'completed' from non-completed
    if (status === 'completed' && currentStatus !== 'completed') {
      if (Array.isArray(order.order_items)) {
        for (const item of order.order_items) {
          const prodId = item.product_id || item.id;
          const qty = Number(item.quantity || 1);
          if (prodId && qty > 0) {
            const { data: product } = await adminClient.from('products').select('stock_quantity').eq('id', prodId).maybeSingle();
            if (product) {
              const currentStock = Number(product.stock_quantity || 0);
              const newStock = Math.max(0, currentStock - qty);
              await adminClient.from('products').update({ stock_quantity: newStock, updated_at: new Date().toISOString() }).eq('id', prodId);
            }
          }
        }
      }
    }

    // Restore stock if status moves to 'returned' or 'cancelled' from 'completed'
    if (['cancelled', 'returned'].includes(status) && currentStatus === 'completed') {
      if (Array.isArray(order.order_items)) {
        for (const item of order.order_items) {
          const prodId = item.product_id || item.id;
          const qty = Number(item.quantity || 1);
          if (prodId && qty > 0) {
            const { data: product } = await adminClient.from('products').select('stock_quantity').eq('id', prodId).maybeSingle();
            if (product) {
              const currentStock = Number(product.stock_quantity || 0);
              const newStock = currentStock + qty;
              await adminClient.from('products').update({ stock_quantity: newStock, updated_at: new Date().toISOString() }).eq('id', prodId);
            }
          }
        }
      }
    }

    // Update status in database using exact order.id
    let { data: updatedOrder, error: updateError } = await adminClient
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', targetOrderId)
      .select('*, order_items(*, product:products(*)), customer:profiles(*)')
      .maybeSingle();

    if (updateError || !updatedOrder) {
      const { data: fbUpdated } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', targetOrderId)
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .maybeSingle();
      updatedOrder = fbUpdated || { ...order, status };
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

    return NextResponse.json({ 
      success: true, 
      data: updatedOrder, 
      order: updatedOrder, 
      message: 'تم تحديث حالة الطلب والمخزون بنجاح' 
    }, { status: 200 });
  } catch (err: any) {
    console.error('Status PATCH error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
