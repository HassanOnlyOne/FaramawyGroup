'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { useNumberFormat } from '@/context/number-format-context';
import { BarChart3, FileText, TrendingUp, Users, ArrowLeft, Package, DollarSign, Loader2, ArrowRight, RefreshCw, ShoppingCart } from 'lucide-react';

export default function ReportsHubPage() {
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [custRes, ordRes, prodRes, payRes] = await Promise.all([
        fetch(`/api/customers?limit=200&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/orders?limit=100&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/products?limit=200&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/payments?limit=200&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      ]);

      if (custRes.ok) {
        const json = await custRes.json();
        setCustomers(json.data || json.customers || []);
      }
      if (ordRes.ok) {
        const json = await ordRes.json();
        setOrders(json.orders || json.data || []);
      }
      if (prodRes.ok) {
        const json = await prodRes.json();
        setProducts(json.products || json.data || []);
      }
      if (payRes.ok) {
        const json = await payRes.json();
        setPayments(json.data || json.payments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  // 1. Live Accounting Aggregations
  const totalDebts = safeCustomers.reduce((acc, c) => {
    const debt = Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0));
    return acc + Math.max(0, debt);
  }, 0);

  const activeOrders = safeOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
  
  const totalSales = activeOrders.reduce((acc, o) => {
    const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
    return acc + tot;
  }, 0);

  const orderCashCollected = activeOrders.reduce((acc, o) => acc + Number(o.paid_amount || 0), 0);
  const directPaymentsCollected = safePayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalCollected = orderCashCollected + directPaymentsCollected;

  const lowStockCount = safeProducts.filter(p => Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 10) && p.is_active !== false).length;

  const filteredCustomers = safeCustomers.filter(c =>
    (c.store_name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.full_name || c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.customer_code || '').includes(customerSearch) ||
    (c.phone || '').includes(customerSearch)
  );

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">مركز التقارير وكشوف الحسابات المجمعة</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">متابعة مديونيات العملاء الإجمالية، حركة المبيعات، ومؤشرات الأداء المالي اللحظية</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي مديونيات العملاء (الأجل)</span>
            <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{formatPriceShort(totalDebts)}</span>
            <span className="text-[11px] text-slate-400 mt-1 block font-medium">مجموع الأرصدة المستحقة على التجار</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي المبيعات المحققة</span>
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatPriceShort(totalSales)}</span>
            <span className="text-[11px] text-slate-400 mt-1 block font-medium">إجمالي قيمة فواتير الطلبات النشطة</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">المقبوضات والتحصيلات النقدية</span>
            <span className="text-2xl font-black text-blue-700 dark:text-blue-400 font-mono">{formatPriceShort(totalCollected)}</span>
            <span className="text-[11px] text-slate-400 mt-1 block font-medium">إجمالي سداد النقدية والمقدمات</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">أصناف حرجة تحت حد الأمان</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{formatNumber(lowStockCount)} صنف</span>
            <span className="text-[11px] text-slate-400 mt-1 block font-medium">تتطلب إعادة طلب وتوريد</span>
          </div>
        </div>

        {/* Section 1: Customer Ledger & Aggregated Debts */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                كشف مديونيات العملاء المجمع (Customer Debts Ledger)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">جدول أرصدة وحدود ائتمان عملاء وتجار الأجل</p>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="بحث باسم المحل أو الكود..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-white font-bold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">كود العميل</th>
                  <th className="p-3.5 whitespace-nowrap">اسم المحل / التاجر</th>
                  <th className="p-3.5 whitespace-nowrap">الهاتف</th>
                  <th className="p-3.5 whitespace-nowrap">حالة الأجل</th>
                  <th className="p-3.5 whitespace-nowrap">الحد الائتماني</th>
                  <th className="p-3.5 whitespace-nowrap">المديونية المستحقة (الحالية)</th>
                  <th className="p-3.5 whitespace-nowrap text-center">كشف الحساب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-medium">لا توجد بيانات مطابقة</td></tr>
                ) : (
                  filteredCustomers.map(c => {
                    const balance = Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0));
                    const limit = Number(c.credit_limit || 50000);
                    const cleanCode = c.customer_code ? String(c.customer_code).replace(/\D/g, '') : (c.id ? String(c.id).slice(-4) : '1004');
                    
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          #{formatNumber(cleanCode)}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 dark:text-white block">{c.store_name || c.full_name || c.name}</span>
                          {c.store_name && <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{c.full_name || c.name}</span>}
                        </td>
                        <td className="p-3.5 font-mono font-medium text-slate-700 dark:text-slate-300" dir="ltr">{c.phone ? formatNumber(c.phone) : '---'}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${Boolean(c.credit_enabled !== false) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {Boolean(c.credit_enabled !== false) ? 'مفعّل' : 'معطّل'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">{formatPriceShort(limit)}</td>
                        <td className={`p-3.5 font-mono font-black text-sm ${balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {formatPriceShort(balance)}
                        </td>
                        <td className="p-3.5 text-center">
                          <Link
                            href={`/admin/customers/${c.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-colors"
                          >
                            <span>فتح الكشف</span>
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Recent Sales Movement */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                حركة المبيعات الإجمالية (Recent Sales Movement)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">أحدث فواتير المبيعات المسجلة وحالة السداد</p>
            </div>
            <Link href="/admin/orders" className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1">
              <span>عرض كافة الطلبات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-white font-bold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">رقم الفاتورة</th>
                  <th className="p-3.5 whitespace-nowrap">التاريخ</th>
                  <th className="p-3.5 whitespace-nowrap">العميل / المتجر</th>
                  <th className="p-3.5 whitespace-nowrap">طريقة الدفع</th>
                  <th className="p-3.5 whitespace-nowrap">إجمالي الفاتورة</th>
                  <th className="p-3.5 whitespace-nowrap">المدفوع نقداً</th>
                  <th className="p-3.5 whitespace-nowrap">المتبقي (آجل)</th>
                  <th className="p-3.5 whitespace-nowrap">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {safeOrders.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500 font-medium">لا توجد طلبات مسجلة</td></tr>
                ) : (
                  safeOrders.slice(0, 15).map(ord => {
                    const invNo = ord.invoice_no || ord.order_number || String(ord.id).slice(0, 8);
                    const cleanInv = String(invNo).replace(/\D/g, '') || invNo;
                    const tot = Number(ord.total !== undefined && ord.total !== null ? ord.total : (ord.total_amount || 0));
                    const pd = Number(ord.paid_amount || 0);
                    const rem = Number(ord.remaining_amount !== undefined && ord.remaining_amount !== null ? ord.remaining_amount : Math.max(0, tot - pd));

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          <Link href={`/admin/orders/${ord.id}`} className="hover:underline">
                            #{formatNumber(cleanInv)}
                          </Link>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400 font-medium">
                          {new Date(ord.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {ord.customer?.store_name || ord.customer?.full_name || ord.store_name_ref || 'عميل'}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${ord.payment_method === 'credit' || rem > 0 ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border border-orange-200 dark:border-orange-800' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`}>
                            {ord.payment_method === 'credit' || rem > 0 ? 'آجل' : 'كاش'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">{formatPriceShort(tot)}</td>
                        <td className="p-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatPriceShort(pd)}</td>
                        <td className="p-3.5 font-mono font-black text-red-600 dark:text-red-400">{formatPriceShort(rem)}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            ord.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                            ord.status === 'cancelled' ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800' :
                            'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {ORDER_STATUS_LABELS[ord.status as keyof typeof ORDER_STATUS_LABELS] || ord.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
