import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function normalizeStatus(status: any): string {
  const s = String(status || '').trim().toLowerCase();
  if (['completed', 'مكتمل', 'delivered', 'تم التوصيل', 'تم الاستلام'].includes(s)) return 'completed';
  if (['pending', 'قيد الانتظار', 'new', 'جديد'].includes(s)) return 'pending';
  if (['approved', 'تمت الموافقة', 'processing', 'قيد التجهيز', 'جاري التجهيز'].includes(s)) return 'approved';
  if (['out_for_delivery', 'delivering', 'shipping', 'جاري التوصيل', 'في الطريق'].includes(s)) return 'out_for_delivery';
  if (['cancelled', 'ملغي', 'ملغى'].includes(s)) return 'cancelled';
  if (['returned', 'مرتجع'].includes(s)) return 'returned';
  return s;
}

function normalizePaymentMethod(method: any): string {
  const m = String(method || '').trim().toLowerCase();
  if (['credit', 'آجل', 'أجل', 'اجل'].includes(m)) return 'credit';
  return 'cash';
}

export async function GET() {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    // 1. جلب البيانات من الجداول
    let { data: orders } = await adminClient
      .from('orders')
      .select('*, customer:profiles(*)')
      .order('created_at', { ascending: false });

    if (!orders) {
      const fb = await supabase.from('orders').select('*, customer:profiles(*)').order('created_at', { ascending: false });
      orders = fb.data || [];
    }

    let { data: profiles } = await adminClient.from('profiles').select('*');
    if (!profiles) {
      const fb = await supabase.from('profiles').select('*');
      profiles = fb.data || [];
    }

    let { data: products } = await adminClient.from('products').select('*');
    if (!products) {
      const fb = await supabase.from('products').select('*');
      products = fb.data || [];
    }

    let { data: purchases } = await adminClient.from('purchases').select('*');
    if (!purchases) {
      const fb = await supabase.from('purchases').select('*');
      purchases = fb.data || [];
    }

    let { data: suppliers } = await adminClient.from('suppliers').select('*');
    if (!suppliers) {
      const fb = await supabase.from('suppliers').select('*');
      suppliers = fb.data || [];
    }

    let { data: directPayments } = await adminClient.from('payments').select('*');
    if (!directPayments) {
      const fb = await supabase.from('payments').select('*');
      directPayments = fb.data || [];
    }

    let { data: customerPayments } = await adminClient.from('customer_payments').select('*');
    if (!customerPayments) {
      customerPayments = [];
    }

    let { data: supplierPayments } = await adminClient.from('supplier_payments').select('*');
    if (!supplierPayments) {
      supplierPayments = [];
    }

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const safePurchases = Array.isArray(purchases) ? purchases : [];
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const safePayments = [...(Array.isArray(directPayments) ? directPayments : []), ...(Array.isArray(customerPayments) ? customerPayments : [])];
    const safeSupPayments = Array.isArray(supplierPayments) ? supplierPayments : [];

    const now = new Date();
    const totalOrdersCount = safeOrders.length;

    // 2. طلبات جديدة قيد الانتظار
    const pendingOrdersCount = safeOrders.filter((o: any) => normalizeStatus(o.status) === 'pending').length;

    // 3. إجمالي المبيعات المحصلة
    const completedOrders = safeOrders.filter((o: any) => normalizeStatus(o.status) === 'completed');
    const totalRevenue = completedOrders.reduce((sum: number, o: any) => {
      const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || o.paid_amount || 0));
      return sum + ordTotal;
    }, 0);

    // 4. تحصيلات اليوم
    const todayCompletedOrders = completedOrders.filter((o: any) => {
      const d = new Date(o.created_at || o.updated_at);
      return isSameDay(d, now);
    });

    const todayOrderCashTotal = todayCompletedOrders.reduce((sum: number, o: any) => {
      const pMethod = normalizePaymentMethod(o.payment_method);
      const paid = Number(o.paid_amount || 0);
      const total = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));

      if (pMethod === 'cash') {
        return sum + (paid > 0 ? paid : total);
      } else if (pMethod === 'credit' && paid > 0) {
        return sum + paid;
      }
      return sum;
    }, 0);

    const todayReceiptsTotal = safePayments.filter((p: any) => {
      const d = new Date(p.payment_date || p.created_at);
      return isSameDay(d, now) && Number(p.amount || 0) > 0;
    }).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    const todayCollections = todayOrderCashTotal + todayReceiptsTotal;

    // 5. إجمالي مديونيات العملاء
    const paymentsByCustomer = new Map<string, number>();
    safePayments.forEach((p: any) => {
      const cid = p.customer_id;
      if (cid) {
        paymentsByCustomer.set(cid, (paymentsByCustomer.get(cid) || 0) + Number(p.amount || 0));
      }
    });

    const activeApprovedOrdersByCustomer = new Map<string, number>();
    safeOrders
      .filter((o: any) => !['pending', 'cancelled', 'returned'].includes(o.status))
      .forEach((o: any) => {
        const cid = o.customer_id;
        if (cid) {
          const isCredit = o.payment_method === 'credit';
          const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
          const ordPaid = Number(o.paid_amount || 0);
          const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
          if (isCredit || rem > 0) {
            activeApprovedOrdersByCustomer.set(cid, (activeApprovedOrdersByCustomer.get(cid) || 0) + rem);
          }
        }
      });

    let calculatedTotalReceivables = 0;
    let calculatedCreditCustomersCount = 0;

    for (const prof of safeProfiles) {
      const cid = prof.id;
      const orderDebt = activeApprovedOrdersByCustomer.get(cid) || 0;
      const customerPaid = paymentsByCustomer.get(cid) || 0;
      
      let customerNetDebt = 0;
      if (orderDebt > 0 || customerPaid > 0) {
        customerNetDebt = Math.max(0, orderDebt - customerPaid);
      } else {
        customerNetDebt = Number(prof.current_debt || 0);
      }

      if (customerNetDebt > 0) {
        calculatedTotalReceivables += customerNetDebt;
        calculatedCreditCustomersCount++;
      }
    }

    const totalReceivables = calculatedTotalReceivables;
    const creditCustomersCount = calculatedCreditCustomersCount;

    // 6. مستحقات الموردين التراكمية الصحيحة (تشمل الرصيد الافتتاحي + فواتير المشتريات - السدادات)
    const totalSupplierPayables = safeSuppliers.reduce((total: number, sup: any) => {
      const opening = Number(sup.opening_balance ?? sup.initial_balance ?? 0);

      const supPurchases = safePurchases.filter((p: any) => {
        if (p.supplier_id && p.supplier_id === sup.id) return true;
        if (sup.name && p.supplier_name && String(p.supplier_name).toLowerCase().includes(String(sup.name).toLowerCase())) return true;
        if (sup.company_name && p.supplier_name && String(p.supplier_name).toLowerCase().includes(String(sup.company_name).toLowerCase())) return true;
        return false;
      });

      const purchasesDebt = supPurchases.reduce((sum: number, p: any) => {
        const tot = Number(p.total ?? p.total_amount ?? 0);
        const pd = Number(p.paid_amount || 0);
        const rem = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, tot - pd));
        return sum + rem;
      }, 0);

      const supPaid = safeSupPayments
        .filter((sp: any) => sp.supplier_id === sup.id)
        .reduce((sum: number, sp: any) => sum + Number(sp.amount || 0), 0);

      const dynamicBalance = Math.max(0, (opening + purchasesDebt) - supPaid);
      return total + dynamicBalance;
    }, 0);

    // 7. تنبيهات نواقص المخزون
    const totalProductsCount = safeProducts.length;
    const lowStockCount = safeProducts.filter((p: any) => {
      const stock = Number(p.stock_quantity !== undefined ? p.stock_quantity : (p.stock || 0));
      const threshold = Number(p.low_stock_threshold || p.min_stock_threshold || 5);
      return stock <= threshold && p.is_active !== false;
    }).length;

    let { data: expenses } = await adminClient.from('expenses').select('*');
    if (!expenses) {
      const fb = await supabase.from('expenses').select('*');
      expenses = fb.data || [];
    }

    const safeExpenses = Array.isArray(expenses) ? expenses : [];

    const todayExpenses = safeExpenses.filter((e: any) => {
      const d = new Date(e.created_at || e.date);
      return isSameDay(d, now);
    }).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    const todaySupplierCashPaid = safePurchases.filter((p: any) => {
      const d = new Date(p.created_at);
      return isSameDay(d, now) && Number(p.paid_amount || 0) > 0;
    }).reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0);

    const todayPayouts = todayExpenses + todaySupplierCashPaid;

    const statsObj = {
      total_orders: totalOrdersCount,
      pending_orders: pendingOrdersCount,
      total_revenue: totalRevenue,
      total_products: totalProductsCount,
      low_stock_count: lowStockCount,
      total_receivables: totalReceivables,
      total_supplier_payables: totalSupplierPayables,
      credit_customers: creditCustomersCount,
      today_collections: todayCollections,
      today_expenses: todayExpenses,
      today_supplier_payments: todaySupplierCashPaid,
      today_payouts: todayPayouts,
      recent_orders: safeOrders.slice(0, 10),
    };

    return new NextResponse(JSON.stringify({
      success: true,
      data: statsObj,
      ...statsObj
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error('Admin Dashboard API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}