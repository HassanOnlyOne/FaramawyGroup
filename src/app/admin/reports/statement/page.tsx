'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useNumberFormat } from '@/context/number-format-context';
import { BarChart3, Users, Package, ShoppingCart, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';

export default function StatementReportsPage() {
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, []);

  async function fetchReportData() {
    setLoading(true);
    try {
      const [custRes, prodRes, ordRes] = await Promise.all([
        fetch(`/api/customers?limit=200&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/products?limit=200&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/orders?limit=100&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      ]);

      if (custRes.ok) {
        const json = await custRes.json();
        setCustomers(json.data || json.customers || []);
      }
      if (prodRes.ok) {
        const json = await prodRes.json();
        setProducts(json.products || json.data || []);
      }
      if (ordRes.ok) {
        const json = await ordRes.json();
        setOrders(json.orders || json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeOrders = Array.isArray(orders) ? orders : [];

  const totalReceivablesSum = safeCustomers.reduce((acc, c) => {
    const debt = Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0));
    return acc + Math.max(0, debt);
  }, 0);

  const activeOrders = safeOrders.filter(o => o.status !== 'cancelled' && o.status !== 'returned');
  const totalSalesSum = activeOrders.reduce((acc, o) => {
    const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
    return acc + tot;
  }, 0);

  const lowStockProducts = safeProducts.filter(p => Number(p.stock_quantity || 0) <= Number(p.low_stock_threshold || 10) && p.is_active !== false);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">تقارير النظام والتحليلات ERP</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">كشوف حسابات العملاء، ربحية المبيعات، ومراقبة حد إعادة الطلب للمخزون</p>
          </div>
          <button
            onClick={fetchReportData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>

        {/* Top Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي المبيعات المحققة</span>
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatPriceShort(totalSalesSum)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي مديونيات العملاء (الأجل)</span>
            <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{formatPriceShort(totalReceivablesSum)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">أصناف تحت حد الطلب</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{formatNumber(lowStockProducts.length)} أصناف</span>
          </div>
        </div>

        {/* Section 1: Customer Account Statement Shortcut */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            استعراض كشف حساب عميل (Customer Account Statement)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-6 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : safeCustomers.slice(0, 12).map(c => {
              const debt = Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0));
              const cleanCode = c.customer_code ? String(c.customer_code).replace(/\D/g, '') : (c.id ? String(c.id).slice(-4) : '1004');

              return (
                <Link key={c.id} href={`/admin/customers/${c.id}`} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all flex justify-between items-center group">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{c.store_name || c.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">كود: #{formatNumber(cleanCode)}</p>
                  </div>
                  <div className="text-left">
                    <span className={`text-xs font-mono font-bold block ${debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {formatPriceShort(debt)}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 justify-end">
                      فتح الكشف <ArrowLeft className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Section 2: Low Stock Warning Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/40 flex justify-between items-center">
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              تنبيهات حد إعادة الطلب للمخزون (Reorder Alerts)
            </h2>
            <Link href="/admin/inventory" className="text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline">عرض المخزون بالكامل</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-white font-bold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="p-3.5">كود SKU</th>
                  <th className="p-3.5">اسم المنتج</th>
                  <th className="p-3.5">الوحدة</th>
                  <th className="p-3.5">الكمية المتبقية</th>
                  <th className="p-3.5">حد الأمان</th>
                  <th className="p-3.5">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {lowStockProducts.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500 font-medium">جميع المنتجات متوفرة بكميات كافية أعلى من حد الأمان ✓</td></tr>
                ) : (
                  lowStockProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(p.sku_code || p.sku || '---')}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{p.name}</td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-300">{p.wholesale_unit || p.unit || 'كرتونة'}</td>
                      <td className="p-3.5 font-black text-red-600 dark:text-red-400 text-sm font-mono">{formatNumber(p.stock_quantity)}</td>
                      <td className="p-3.5 font-bold text-slate-700 dark:text-slate-300 font-mono">{formatNumber(p.low_stock_threshold || 10)}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800">
                          مخزون حرج!
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
