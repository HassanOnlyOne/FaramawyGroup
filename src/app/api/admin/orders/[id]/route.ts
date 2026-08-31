import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction, logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let query = adminClient
      .from('orders')
      .select('*, order_items(*, product:products(*)), customer:profiles(*)');

    if (id.startsWith('INV-')) {
      query = query.eq('invoice_no', id);
    } else if (id.startsWith('ORD-')) {
      query = query.eq('order_number', id);
    } else {
      query = query.or(`id.eq.${id},order_number.eq.${id},invoice_no.eq.${id}`);
    }

    let { data: orderList, error } = await query;
    let order = orderList && orderList[0];

    if (error || !order) {
      let fbQuery = supabase.from('orders').select('*, order_items(*, product:products(*)), customer:profiles(*)');
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

    return NextResponse.json({ success: true, data: order, order }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function handleOrderUpdate(req: NextRequest, id: string) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { 
      items, 
      shipping_fee, 
      delivery_fee, 
      shipping_cost,
      discount_amount, 
      discount, 
      total_amount, 
      total, 
      paid_amount, 
      remaining_amount,
      remaining_credit_amount,
      admin_notes, 
      delivery_address, 
      contact_phone, 
      status,
      payment_method 
    } = body;

    let query = adminClient.from('orders').select('*, order_items(*), customer:profiles(*)');
    if (id.startsWith('INV-')) {
      query = query.eq('invoice_no', id);
    } else if (id.startsWith('ORD-')) {
      query = query.eq('order_number', id);
    } else {
      query = query.or(`id.eq.${id},order_number.eq.${id},invoice_no.eq.${id}`);
    }

    let { data: existingList } = await query;
    let existingOrder = existingList && existingList[0];

    if (!existingOrder) {
      let fbQuery = supabase.from('orders').select('*, order_items(*), customer:profiles(*)');
      if (id.startsWith('INV-')) fbQuery = fbQuery.eq('invoice_no', id);
      else if (id.startsWith('ORD-')) fbQuery = fbQuery.eq('order_number', id);
      else fbQuery = fbQuery.or(`id.eq.${id},order_number.eq.${id},invoice_no.eq.${id}`);
      const fbRes = await fbQuery;
      existingOrder = fbRes.data && fbRes.data[0];
    }

    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'الطلب غير موجود' }, { status: 404 });
    }

    const targetOrderId = existingOrder.id;
    const isCompletedOrDeducted = Boolean(existingOrder.stock_deducted || existingOrder.status === 'completed');

    const shipFee = shipping_fee !== undefined ? Number(shipping_fee) : (delivery_fee !== undefined ? Number(delivery_fee) : (shipping_cost !== undefined ? Number(shipping_cost) : Number(existingOrder.delivery_fee || 0)));
    const discFee = discount_amount !== undefined ? Number(discount_amount) : (discount !== undefined ? Number(discount) : Number(existingOrder.discount || 0));

    let subtotal = 0;
    if (Array.isArray(items)) {
      // 1. Stock Adjustment for Edit Order Items if order was already completed/deducted
      if (isCompletedOrDeducted && Array.isArray(existingOrder.order_items)) {
        const oldQtyMap = new Map<string, number>();
        for (const oldIt of existingOrder.order_items) {
          const pId = oldIt.product_id || oldIt.product?.id;
          const q = Number(oldIt.quantity || 0);
          if (pId && q > 0) {
            oldQtyMap.set(pId, (oldQtyMap.get(pId) || 0) + q);
          }
        }

        const newQtyMap = new Map<string, number>();
        for (const newIt of items) {
          const pId = newIt.product_id || newIt.id;
          const q = Number(newIt.quantity || 0);
          if (pId && q > 0) {
            newQtyMap.set(pId, (newQtyMap.get(pId) || 0) + q);
          }
        }

        const allProductIds = new Set<string>([...oldQtyMap.keys(), ...newQtyMap.keys()]);

        for (const prodId of allProductIds) {
          const oldQty = oldQtyMap.get(prodId) || 0;
          const newQty = newQtyMap.get(prodId) || 0;
          const diff = newQty - oldQty;

          if (diff !== 0) {
            const { data: product } = await adminClient
              .from('products')
              .select('stock_quantity')
              .eq('id', prodId)
              .maybeSingle();

            if (product) {
              const currentStock = Number(product.stock_quantity || 0);
              // If diff > 0 (quantity increased/new item): deduct diff
              // If diff < 0 (quantity decreased/item removed): restore abs(diff)
              const newStock = Math.max(0, currentStock - diff);
              await adminClient
                .from('products')
                .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
                .eq('id', prodId);
            }
          }
        }
      }

      subtotal = items.reduce((sum: number, it: any) => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || it.price || 0);
        return sum + (it.total_price ? Number(it.total_price) : qty * price);
      }, 0);

      const orderItemsToInsert = items.map((it: any) => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || it.price || 0);
        return {
          id: crypto.randomUUID(),
          order_id: targetOrderId,
          product_id: it.product_id || it.id,
          quantity: qty,
          unit_price: price,
          total_price: Number(it.total_price || (qty * price))
        };
      });

      // Clear previous order items and insert new items
      await adminClient.from('order_items').delete().eq('order_id', targetOrderId);
      await adminClient.from('order_items').insert(orderItemsToInsert);
    } else {
      subtotal = Number(existingOrder.subtotal || 0);
    }

    const finalTotal = total_amount !== undefined ? Number(total_amount) : (total !== undefined ? Number(total) : Math.max(0, subtotal + shipFee - discFee));
    const finalPaid = paid_amount !== undefined ? Number(paid_amount) : Number(existingOrder.paid_amount || 0);
    const finalRemaining = remaining_amount !== undefined ? Number(remaining_amount) : (remaining_credit_amount !== undefined ? Number(remaining_credit_amount) : Math.max(0, finalTotal - finalPaid));
    const finalMethod = payment_method || (finalRemaining > 0 ? 'credit' : (existingOrder.payment_method || 'cash'));

    const updatePayload: any = {
      subtotal,
      discount: discFee,
      discount_amount: discFee,
      delivery_fee: shipFee,
      shipping_fee: shipFee,
      shipping_cost: shipFee,
      total: finalTotal,
      total_amount: finalTotal,
      paid_amount: finalPaid,
      remaining_amount: finalRemaining,
      payment_method: finalMethod,
      updated_at: new Date().toISOString()
    };

    if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;
    if (delivery_address !== undefined) updatePayload.delivery_address = delivery_address;
    if (contact_phone !== undefined) updatePayload.contact_phone = contact_phone;
    if (status !== undefined) updatePayload.status = status;

    let { data: updatedOrder, error: updateError } = await adminClient
      .from('orders')
      .update(updatePayload)
      .eq('id', targetOrderId)
      .select('*, order_items(*, product:products(*)), customer:profiles(*)')
      .maybeSingle();

    if (updateError || !updatedOrder) {
      const corePayload = { ...updatePayload };
      delete corePayload.discount_amount;
      delete corePayload.shipping_fee;
      delete corePayload.shipping_cost;
      delete corePayload.total_amount;

      const fbRes = await supabase
        .from('orders')
        .update(corePayload)
        .eq('id', targetOrderId)
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .maybeSingle();
      updatedOrder = fbRes.data || { ...existingOrder, ...updatePayload };
    }

    // Cumulative recalculation of customer debt in profiles
    const targetCustomerId = existingOrder.customer_id;
    if (targetCustomerId) {
      const { data: customerOrders } = await adminClient
        .from('orders')
        .select('id, total, total_amount, paid_amount, remaining_amount, payment_method, status')
        .eq('customer_id', targetCustomerId);

      if (customerOrders) {
        const totalCustomerDebt = customerOrders
          .filter((o: any) => !['cancelled', 'returned'].includes(o.status))
          .reduce((sum: number, o: any) => {
            if (o.id === targetOrderId) {
              return sum + finalRemaining;
            }
            const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
            const ordPaid = Number(o.paid_amount || 0);
            const rem = o.remaining_amount !== null && o.remaining_amount !== undefined ? Number(o.remaining_amount) : Math.max(0, ordTotal - ordPaid);
            return sum + rem;
          }, 0);

        try {
          await adminClient.from('profiles').update({
            previous_balance: totalCustomerDebt,
            current_debt: totalCustomerDebt,
            debt_balance: totalCustomerDebt
          }).eq('id', targetCustomerId);
        } catch {
          await adminClient.from('profiles').update({
            previous_balance: totalCustomerDebt
          }).eq('id', targetCustomerId);
        }
      }
    }

    const orderNum = updatedOrder?.invoice_no || updatedOrder?.order_number || targetOrderId;
    await logActivity(
      'تعديل فاتورة مبيعات',
      `تعديل أصناف وإجمالي الفاتورة #${orderNum} بإجمالي ${finalTotal} ج.م ومتبقي أجل ${finalRemaining} ج.م`,
      'sales'
    );

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      order: updatedOrder,
      message: 'تم حفظ وتحديث الفاتورة والمخزون ومديونية العميل بنجاح'
    }, { status: 200 });
  } catch (err: any) {
    console.error('Update Order Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'فشل تعديل الفاتورة' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleOrderUpdate(req, id);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleOrderUpdate(req, id);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let query = adminClient.from('orders').select('*, customer:profiles(*)');
    if (id.startsWith('INV-')) query = query.eq('invoice_no', id);
    else if (id.startsWith('ORD-')) query = query.eq('order_number', id);
    else query = query.or(`id.eq.${id},order_number.eq.${id},invoice_no.eq.${id}`);

    let { data: orderList } = await query;
    let order = orderList && orderList[0];

    if (!order) {
      const fbRes = await supabase.from('orders').select('*, customer:profiles(*)').eq('id', id).maybeSingle();
      order = fbRes.data;
    }

    if (!order) {
      return NextResponse.json({ success: false, error: 'الطلب غير موجود' }, { status: 404 });
    }

    const isCancelled = ['cancelled', 'ملغي', 'ملغى'].includes(String(order.status || '').toLowerCase());
    if (!isCancelled) {
      return NextResponse.json({ 
        success: false, 
        error: 'لا يمكن حذف هذا الطلب لأنه ليس في حالة ملغي. يرجى إلغاء الطلب أولاً قبل حذفه نهائياً.' 
      }, { status: 400 });
    }

    const targetOrderId = order.id;

    await adminClient.from('order_items').delete().eq('order_id', targetOrderId);

    const { error: delError } = await adminClient.from('orders').delete().eq('id', targetOrderId);
    if (delError) {
      await supabase.from('orders').delete().eq('id', targetOrderId);
    }

    await logAction({
      actionType: 'حذف طلب ملغي',
      category: 'المبيعات والفواتير',
      details: `تم حذف الطلب الملغي #${order.invoice_no || order.order_number || targetOrderId} نهائياً من قاعدة البيانات`
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف الطلب الملغي نهائياً بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Delete Order Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
