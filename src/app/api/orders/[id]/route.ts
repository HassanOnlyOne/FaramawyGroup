import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

    let { data: order } = await adminClient
      .from('orders')
      .select('*, order_items(*, product:products(*)), customer:profiles(*)')
      .eq('id', id)
      .maybeSingle();

    if (!order) {
      const { data: byInv } = await adminClient
        .from('orders')
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .eq('invoice_no', id)
        .maybeSingle();
      order = byInv;
    }

    if (!order) {
      const { data: byOrdNum } = await adminClient
        .from('orders')
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .eq('order_number', id)
        .maybeSingle();
      order = byOrdNum;
    }

    if (!order) {
      const fb = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .eq('id', id)
        .maybeSingle();
      order = fb.data;
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

    // 1. Fetch existing order
    let { data: existingOrder } = await adminClient
      .from('orders')
      .select('*, order_items(*), customer:profiles(*)')
      .eq('id', id)
      .maybeSingle();

    if (!existingOrder) {
      const { data: byInv } = await adminClient
        .from('orders')
        .select('*, order_items(*), customer:profiles(*)')
        .eq('invoice_no', id)
        .maybeSingle();
      existingOrder = byInv;
    }

    if (!existingOrder) {
      const { data: byOrdNum } = await adminClient
        .from('orders')
        .select('*, order_items(*), customer:profiles(*)')
        .eq('order_number', id)
        .maybeSingle();
      existingOrder = byOrdNum;
    }

    if (!existingOrder) {
      const fb = await supabase
        .from('orders')
        .select('*, order_items(*), customer:profiles(*)')
        .eq('id', id)
        .maybeSingle();
      existingOrder = fb.data;
    }

    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'الطلب غير موجود' }, { status: 404 });
    }

    const targetOrderId = existingOrder.id;

    // 2. Update order items if provided
    let subtotal = 0;
    if (Array.isArray(items) && items.length > 0) {
      subtotal = items.reduce((sum: number, it: any) => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || it.price || 0);
        return sum + (it.total_price !== undefined ? Number(it.total_price) : qty * price);
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
          total_price: Number(it.total_price !== undefined ? it.total_price : (qty * price))
        };
      });

      // Clear previous items and insert new items
      await adminClient.from('order_items').delete().eq('order_id', targetOrderId);
      
      const { error: insertErr } = await adminClient.from('order_items').insert(orderItemsToInsert);
      if (insertErr) {
        const fallbackItems = orderItemsToInsert.map(({ id: _i, ...rest }) => rest);
        await adminClient.from('order_items').insert(fallbackItems);
      }
    } else {
      subtotal = Number(existingOrder.subtotal || 0);
    }

    // 3. Calculate final amounts
    const shipFee = shipping_fee !== undefined ? Number(shipping_fee) : (delivery_fee !== undefined ? Number(delivery_fee) : Number(existingOrder.delivery_fee || 0));
    const discFee = discount_amount !== undefined ? Number(discount_amount) : (discount !== undefined ? Number(discount) : Number(existingOrder.discount || 0));

    const finalTotal = total_amount !== undefined 
      ? Number(total_amount) 
      : (total !== undefined ? Number(total) : Math.max(0, subtotal + shipFee - discFee));
    
    const specifiedMethod = payment_method || existingOrder.payment_method || 'cash';
    const isCash = specifiedMethod === 'cash';

    const finalPaid = isCash 
      ? finalTotal 
      : (paid_amount !== undefined ? Number(paid_amount) : Number(existingOrder.paid_amount || 0));
    
    const finalRemaining = isCash 
      ? 0 
      : (remaining_amount !== undefined ? Number(remaining_amount) : (remaining_credit_amount !== undefined ? Number(remaining_credit_amount) : Math.max(0, finalTotal - finalPaid)));
    
    const finalMethod = finalRemaining > 0 ? 'credit' : 'cash';

    const updatePayload: any = {
      subtotal,
      discount: discFee,
      delivery_fee: shipFee,
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
      delete corePayload.total_amount;

      const fbRes = await supabase
        .from('orders')
        .update(corePayload)
        .eq('id', targetOrderId)
        .select('*, order_items(*, product:products(*)), customer:profiles(*)')
        .maybeSingle();
      updatedOrder = fbRes.data || { ...existingOrder, ...updatePayload };
    }

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      order: updatedOrder,
      message: 'تم حفظ وتحديث الطلب بنجاح'
    }, { status: 200 });
  } catch (err: any) {
    console.error('Update Order Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'فشل تعديل الطلب' }, { status: 500 });
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
  const { DELETE: adminDelete } = await import('@/app/api/admin/orders/[id]/route');
  return adminDelete(req, context);
}
