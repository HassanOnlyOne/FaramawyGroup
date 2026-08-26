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

    // 1. Fetch live records from database
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

    let { data: directPayments } = await adminClient.from('payments').select('*');
    if (!directPayments) {
      const fb = await supabase.from('payments').select('*');
      directPayments = fb.data || [];
    }

    let { data: customerPayments } = await adminClient.from('customer_payments').select('*');
    if (!customerPayments) {
      customerPayments = [];
    }

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const safePurchases = Array.isArray(purchases) ? purchases : [];
    const safePayments = [...(Array.isArray(directPayments) ? directPayments : []), ...(Array.isArray(customerPayments) ? customerPayments : [])];

    // 2. Pure Accounting Calculations
    const now = new Date();
    const totalOrdersCount = safeOrders.length;

    // 3. Card: "طلبات جديدة قيد الانتظار" (pending / new / قيد الانتظار)
    const pendingOrdersCount = safeOrders.filter((o: any) => {
      const norm = normalizeStatus(o.status);
      return norm === 'pending';
    }).length;

    // 4. Card: "إجمالي المبيعات (المحصلة)" (Completed Orders total value + completed collections)
    const completedOrders = safeOrders.filter((o: any) => {
      const norm = normalizeStatus(o.status);
      return norm === 'completed';
    });

    const totalRevenue = completedOrders.reduce((sum: number, o: any) => {
      const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || o.paid_amount || 0));
      return sum + ordTotal;
    }, 0);

    // 5. Card: "تحصيلات اليوم" (Actual cash collected today from active completed orders + direct payment receipts)
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

    // 6. Card: "إجمالي مديونيات العملاء" (Sum current_debt from profiles for debt > 0)
    const totalReceivables = safeProfiles.reduce((sum: number, p: any) => {
      const debt = Number(p.current_debt !== undefined && p.current_debt !== null ? p.current_debt : (p.previous_balance || 0));
      return sum + (debt > 0 ? debt : 0);
    }, 0);

    // 7. Card: "عملاء الآجل النشطون"
    const creditCustomersCount = safeProfiles.filter((p: any) => {
      const debt = Number(p.current_debt !== undefined && p.current_debt !== null ? p.current_debt : (p.previous_balance || 0));
      return debt > 0;
    }).length;

    // 8. Card: "مستحقات الموردين (آجل)"
    const totalSupplierPayables = safePurchases.reduce((sum: number, p: any) => {
      const tot = Number(p.total !== undefined && p.total !== null ? p.total : (p.total_amount || 0));
      const pd = Number(p.paid_amount || 0);
      const rem = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, tot - pd));
      return sum + Math.max(0, rem);
    }, 0);

    // 9. Card: "تنبيهات نواقص المخزون" (stock_quantity <= threshold or <= 5)
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

    // Calculate today's payouts (expenses + supplier cash payments)
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
