import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateTieredPrice } from '@/lib/pricing';
import { logAction } from '@/lib/audit';
import { MIN_ORDER_AMOUNT } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAuthUser(supabase: any) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

async function getNextInvoiceNumber(adminClient: any, supabase: any): Promise<string> {
  try {
    const { data: orders } = await adminClient
      .from('orders')
      .select('order_number, invoice_no')
      .order('created_at', { ascending: false })
      .limit(100);

    let maxNum = 9999;
    if (orders && orders.length > 0) {
      for (const ord of orders) {
        const num1 = parseInt(String(ord.order_number || '').replace(/\D/g, ''), 10);
        const num2 = parseInt(String(ord.invoice_no || '').replace(/\D/g, ''), 10);
        if (!isNaN(num1) && num1 >= 10000 && num1 < 9999999) {
          if (num1 > maxNum) maxNum = num1;
        }
        if (!isNaN(num2) && num2 >= 10000 && num2 < 9999999) {
          if (num2 > maxNum) maxNum = num2;
        }
      }
    }
    return String(maxNum + 1);
  } catch {
    return '10000';
  }
}

async function getNextCustomerCode(adminClient: any, supabase: any): Promise<string> {
  try {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('customer_code')
      .order('created_at', { ascending: false })
      .limit(200);

    let maxCode = 999;
    if (profiles && profiles.length > 0) {
      for (const prof of profiles) {
        const num = parseInt(String(prof.customer_code || '').replace(/\D/g, ''), 10);
        if (!isNaN(num) && num >= 1000 && num < 999999) {
          if (num > maxCode) maxCode = num;
        }
      }
    }
    return String(maxCode + 1);
  } catch {
    return '1000';
  }
}

function contactPhoneClean(p: string) {
  return String(p || '').replace(/\D/g, '');
}

// GET: List orders
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const user = await getAuthUser(supabase);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('orders')
      .select('*, order_items(*, product:products(*)), customer:profiles(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    } else if (user) {
      const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const isAdmin = profile?.role === 'admin' || profile?.role === 'staff' || profile?.role === 'owner';
      if (!isAdmin) {
        query = query.eq('customer_id', user.id);
      }
    } else {
      return NextResponse.json({ data: [], orders: [], pagination: { total: 0, page, limit } }, { status: 200 });
    }
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    let { data: orders, count, error } = await query;

    if (error || !orders) {
      let fbQuery = supabase
        .from('orders')
        .select('*, order_items(*, product:products(*)), customer:profiles(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (status && status !== 'all') fbQuery = fbQuery.eq('status', status);
      const fbRes = await fbQuery;
      orders = fbRes.data || [];
      count = fbRes.count || orders.length;
    }

    return NextResponse.json({ data: orders || [], orders: orders || [], pagination: { total: count, page, limit } }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create order
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const user = await getAuthUser(supabase);
    
    const body = await req.json();
    const { 
      items, 
      delivery_address, 
      shipping_address,
      contact_phone, 
      secondary_phone,
      customer_name,
      store_name,
      customer_notes,
      order_notes,
      payment_method,
      paid_amount,
      remaining_amount,
      previous_balance,
      customer_code,
      customer_id: passedCustomerId,
      delegate_name,
      total_amount,
      total: passedTotal
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'الطلب يجب أن يحتوي على منتجات' }, { status: 400 });
    }

    const method = (payment_method === 'credit' || payment_method === 'آجل' || payment_method === 'credit_payment') ? 'credit' : 'cash';

    // 1. Determine customer_id (STRICT: Authentication required, no guest checkouts)
    if (!user) {
      return NextResponse.json({
        error: 'عفواً، يجب تسجيل الدخول بحساب تاجر مسجل لإتمام طلب التوريد'
      }, { status: 401 });
    }

    const customerId = user.id;
    const { data: prof } = await adminClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const customerProfile = prof;

    if (!customerProfile) {
      return NextResponse.json({
        error: 'عفواً، لم يتم العثور على ملف تعريف التاجر المسجل'
      }, { status: 401 });
    }

    // 2. Validate requested quantity against stock limit and check if product is paused
    const aggregatedQty = new Map<string, number>();
    for (const item of items) {
      const pId = item.product_id || item.product?.id || item.id;
      const q = Number(item.quantity || 0);
      if (pId && q > 0) {
        aggregatedQty.set(pId, (aggregatedQty.get(pId) || 0) + q);
      }
    }

    for (const [pId, totalRequested] of aggregatedQty.entries()) {
      const { data: dbProd } = await adminClient
        .from('products')
        .select('name, stock_quantity, wholesale_unit, unit, is_paused, is_active')
        .eq('id', pId)
        .maybeSingle();

      if (dbProd) {
        if (dbProd.is_paused) {
          return NextResponse.json({
            error: `عفواً، صنف (${dbProd.name}) متوقف مؤقتاً عن الطلب حالياً`
          }, { status: 400 });
        }
        const availStock = Number(dbProd.stock_quantity ?? 0);
        if (totalRequested > availStock) {
          const unitName = dbProd.wholesale_unit || dbProd.unit || 'كرتونة';
          return NextResponse.json({
            error: `عفواً، الكمية المطلوبة من صنف (${dbProd.name}) غير متوفرة حالياً (المتبقي في المخزن: ${availStock} ${unitName})`
          }, { status: 400 });
        }
      }
    }

    let subtotal = 0;
    const orderItemsToInsert = [];

    for (const item of items) {
      const targetProdId = item.product_id || item.product?.id || item.id;
      let product = item.product;

      if (!product && targetProdId) {
        const { data: prodData } = await adminClient
          .from('products')
          .select('*, pricing_tiers(*)')
          .eq('id', targetProdId)
          .maybeSingle();
        product = prodData;
      }

      if (!product) {
        const itemQty = Number(item.quantity) || 1;
        const itemPrice = Number(item.unit_price || item.price || 0);
        const itemTotal = Number(item.total_price || (itemQty * itemPrice));
        subtotal += itemTotal;

        orderItemsToInsert.push({
          product_id: targetProdId,
          quantity: itemQty,
          unit_price: itemPrice,
          total_price: itemTotal
        });
        continue;
      }

      const itemQty = Number(item.quantity) || 1;
      const unitPrice = calculateTieredPrice(product, itemQty);
      const itemTotal = unitPrice * itemQty;
      
      subtotal += itemTotal;
      
      orderItemsToInsert.push({
        product_id: product.id,
        quantity: itemQty,
        unit_price: unitPrice,
        total_price: itemTotal
      });
    }

    const discount = 0;
    const calculatedTotal = passedTotal !== undefined ? Number(passedTotal) : (total_amount ? Number(total_amount) : (subtotal - discount));
    const total = Number(calculatedTotal);

    // 3. Wholesale Minimum Order Amount Validation (20,000 EGP)
    if (total < MIN_ORDER_AMOUNT) {
      return NextResponse.json({
        error: `عفواً، الحد الأدنى لقيمة الطلب لتجار الجملة هو ${MIN_ORDER_AMOUNT.toLocaleString('ar-EG')} ج.م. إجمالي طلبك الحالي: ${total.toLocaleString('ar-EG')} ج.م`
      }, { status: 400 });
    }
    
    const prevBalance = Number(customerProfile?.current_debt !== undefined && customerProfile?.current_debt !== null ? customerProfile.current_debt : (customerProfile?.previous_balance || 0));

    // 4. Calculate finalPaid, finalRemaining, and Surplus Payment
    const finalPaid = method === 'cash' 
      ? total 
      : Math.max(0, Number(paid_amount || 0));
    
    const finalRemaining = method === 'cash' 
      ? 0 
      : (finalPaid >= total ? 0 : Math.max(0, total - finalPaid));

    const surplusDebtPayment = (method === 'credit' && finalPaid > total) ? (finalPaid - total) : 0;

    // 5. Strict Credit Validation: check if remaining credit exceeds available credit
    if (method === 'credit') {
      const creditLimit = Number(customerProfile?.credit_limit || 0);
      const currentDebt = Number(customerProfile?.current_debt !== undefined && customerProfile?.current_debt !== null ? customerProfile.current_debt : (customerProfile?.previous_balance || 0));
      const isCreditEnabled = customerProfile?.is_credit_enabled !== false && customerProfile?.credit_enabled !== false && creditLimit > 0;

      if (!isCreditEnabled) {
        return NextResponse.json({
          error: 'عفواً، خاصية الشراء بالآجل غير مفعلة لحسابك'
        }, { status: 400 });
      }

      const availableCredit = Math.max(0, creditLimit - currentDebt);

      if (finalRemaining > availableCredit) {
        return NextResponse.json({
          error: 'لا يمكن إتمام الطلب، المتبقي الآجل يتجاوز رصيدك الائتماني المتاح'
        }, { status: 400 });
      }
    }

    let finalNotes = customer_notes || order_notes || '';
    if (surplusDebtPayment > 0) {
      const noteSurplus = `[دفعة كاش مقدمة ${finalPaid} ج.م تتضمن سداد ${surplusDebtPayment} ج.م من المديونية السابقة]`;
      finalNotes = finalNotes ? `${finalNotes} ${noteSurplus}` : noteSurplus;
    }

    // Pure sequential numeric invoice/order number starting from 10000
    const nextInvoiceNumber = await getNextInvoiceNumber(adminClient, supabase);

    const baseOrderPayload: any = {
      order_number: nextInvoiceNumber,
      invoice_no: nextInvoiceNumber,
      customer_id: customerId,
      status: 'pending',
      payment_method: method,
      subtotal: subtotal || total,
      discount,
      total: total,
      total_amount: total,
      delivery_address: delivery_address || shipping_address || customerProfile?.address || '',
      contact_phone: contactPhoneClean(contact_phone || customerProfile?.phone || ''),
      customer_notes: finalNotes,
      admin_notes: customer_name ? `اسم المستلم/المحل: ${customer_name}` : null,
      store_code: '1',
      store_name_ref: store_name || customer_name || customerProfile?.store_name || 'المخزن الرئيسي',
      delegate_name: delegate_name || '',
      previous_balance: prevBalance,
      paid_amount: finalPaid,
      remaining_amount: finalRemaining,
      current_balance: method === 'credit' ? Math.max(0, prevBalance + finalRemaining - surplusDebtPayment) : prevBalance,
      stock_deducted: false
    };

    // Clean undefined fields
    Object.keys(baseOrderPayload).forEach(k => {
      if (baseOrderPayload[k] === undefined) delete baseOrderPayload[k];
    });

    let order: any = null;
    let orderError: any = null;

    // Attempt 1: Standard payload
    const res1 = await adminClient
      .from('orders')
      .insert([baseOrderPayload])
      .select()
      .maybeSingle();

    order = res1.data;
    orderError = res1.error;

    // Attempt 2: If failed with trigger or column issue
    if (orderError || !order) {
      console.warn('Attempt 1 order insert error:', orderError?.message);
      
      const payload2: any = { ...baseOrderPayload };
      payload2.invoice_number = nextInvoiceNumber;
      payload2.total = total;
      payload2.total_amount = total;
      
      const res2 = await adminClient.from('orders').insert([payload2]).select().maybeSingle();
      if (res2.data) {
        order = res2.data;
        orderError = null;
      }
    }

    // Attempt 3: Core minimal columns only
    if (orderError || !order) {
      console.warn('Attempt 2 failed, trying core minimal payload...');
      const corePayload: any = {
        order_number: nextInvoiceNumber,
        customer_id: customerId,
        status: 'pending',
        payment_method: method,
        subtotal: subtotal || total,
        discount: 0,
        total: total,
        total_amount: total,
        delivery_address: delivery_address || shipping_address || '',
        contact_phone: contactPhoneClean(contact_phone || ''),
        customer_notes: finalNotes,
        store_code: '1',
        store_name_ref: store_name || customer_name || 'المخزن الرئيسي',
        previous_balance: prevBalance,
        paid_amount: finalPaid,
        remaining_amount: finalRemaining,
        current_balance: method === 'credit' ? Math.max(0, prevBalance + finalRemaining - surplusDebtPayment) : prevBalance,
        stock_deducted: false
      };

      const res3 = await adminClient.from('orders').insert([corePayload]).select().maybeSingle();
      if (res3.data) {
        order = res3.data;
        orderError = null;
      } else {
        const resFb = await supabase.from('orders').insert([corePayload]).select().maybeSingle();
        order = resFb.data;
        orderError = resFb.error;
      }
    }

    if (orderError || !order) {
      console.error('Final Order Insert Error:', orderError);
      return NextResponse.json({ error: orderError?.message || 'فشل إرسال الطلب' }, { status: 400 });
    }

    // Insert order items
    if (orderItemsToInsert.length > 0) {
      const formattedOrderItems = orderItemsToInsert.map(oi => ({
        id: crypto.randomUUID(),
        ...oi,
        order_id: order.id
      }));

      await adminClient.from('order_items').insert(formattedOrderItems);
    }

    // Log in audit log
    await logAction({
      actionType: 'إنشاء طلب جديد',
      category: 'المبيعات والفواتير',
      details: `تسجيل طلب بيع جديد #${nextInvoiceNumber} للعميل (${customerProfile?.store_name || customerProfile?.full_name || customer_name || customerId}) بإجمالي ${total} ج.م - طريقة الدفع: ${method === 'credit' ? 'أجل' : 'كاش نقدي'}${surplusDebtPayment > 0 ? ` (مسدد دفعة كاش ${finalPaid} ج.م تتضمن سداد ${surplusDebtPayment} ج.م من المديونية السابقة)` : ''}`,
      user: {
        id: user?.id || customerId,
        name: customerProfile?.store_name || customerProfile?.full_name || customer_name || 'عميل المتجر',
        role: customerProfile?.role || 'عميل'
      }
    });

    const fullOrder = {
      ...order,
      id: order.id,
      order_number: nextInvoiceNumber,
      invoice_no: nextInvoiceNumber,
      order_items: orderItemsToInsert,
      customer: customerProfile
    };

    return NextResponse.json({ 
      success: true, 
      id: order.id, 
      order_id: order.id, 
      order_number: nextInvoiceNumber,
      invoice_no: nextInvoiceNumber,
      order: fullOrder,
      data: fullOrder
    }, { status: 201 });

  } catch (err: any) {
    console.error('Order POST Exception:', err);
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب' }, { status: 500 });
  }
}
