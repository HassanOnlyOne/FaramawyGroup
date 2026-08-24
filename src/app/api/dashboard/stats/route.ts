import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    // 1. Fetch live records
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

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const safePurchases = Array.isArray(purchases) ? purchases : [];

    // 2. Pure Calculations
    const totalOrdersCount = safeOrders.length;
    const pendingOrdersCount = safeOrders.filter((o: any) => o.status === 'pending').length;

    // Total Revenue: مجموع المبالغ المحصلة فعلياً
    const completedOrders = safeOrders.filter((o: any) => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum: number, o: any) => {
      return sum + Number(o.paid_amount || 0);
    }, 0);

    // Total Receivables: مجموع المديونيات الحقيقية من جدول profiles
    const totalReceivables = safeProfiles.reduce((sum: number, p: any) => {
      const debt = Number(p.current_debt !== undefined && p.current_debt !== null ? p.current_debt : (p.previous_balance || 0));
      return sum + Math.max(0, debt);
    }, 0);

    // Active Credit Customers: عدد العملاء الذين لديهم مديونية > 0
    const creditCustomersCount = safeProfiles.filter((p: any) => {
      const debt = Number(p.current_debt !== undefined && p.current_debt !== null ? p.current_debt : (p.previous_balance || 0));
      return debt > 0;
    }).length;

    // Total Supplier Payables
    const totalSupplierPayables = safePurchases.reduce((sum: number, p: any) => {
      const tot = Number(p.total !== undefined && p.total !== null ? p.total : (p.total_amount || 0));
      const pd = Number(p.paid_amount || 0);
      const rem = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, tot - pd));
      return sum + rem;
    }, 0);

    // Today Collections: (المقدمات النقدية المسددة كاش من فواتير اليوم orders.paid_amount) + (سندات القبض النقدية المسجلة اليوم)
    const today = new Date().toISOString().split('T')[0];

    const activeOrders = safeOrders.filter((o: any) => o.status !== 'cancelled' && o.status !== 'returned');
    const orderCashToday = activeOrders
      .filter((o: any) => {
        const orderDateStr = String(o.created_at || o.updated_at || '').split('T')[0];
        return orderDateStr === today;
      })
      .reduce((sum: number, o: any) => sum + Number(o.paid_amount || 0), 0);

    let customerPaymentsToday = 0;

    try {
      const { data: custPayments } = await adminClient
        .from('customer_payments')
        .select('amount, created_at')
        .gte('created_at', `${today}T00:00:00.000Z`);

      if (custPayments && custPayments.length > 0) {
        customerPaymentsToday += custPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      }
    } catch {}

    try {
      const { data: directPayments } = await adminClient
        .from('payments')
        .select('amount, created_at, payment_date')
        .gte('created_at', `${today}T00:00:00.000Z`);

      if (directPayments && directPayments.length > 0) {
        customerPaymentsToday += directPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      }
    } catch {}

    const todayCollections = orderCashToday + customerPaymentsToday;

    // Inventory metrics
    const totalProductsCount = safeProducts.length;
    const lowStockCount = safeProducts.filter((p: any) => Number(p.stock_quantity || 0) < 10 && p.is_active !== false).length;

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
    console.error('Stats API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
