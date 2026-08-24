'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { useNumberFormat } from '@/context/number-format-context';
import { Package, ShoppingCart, DollarSign, AlertTriangle, Users, TrendingUp, CreditCard, Banknote, Truck, ArrowLeft } from 'lucide-react';

export default function AdminDashboard() {
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        let res = await fetch(`/api/admin/dashboard?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) {
          res = await fetch(`/api/dashboard/stats?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          });
        }
        if (res.ok) {
          const json = await res.json();
          setStats(json.data || json);
        }
      } catch (error) {
        console.error('Fetch Stats Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { label: 'إجمالي المبيعات (المحصلة)', value: formatPriceShort(stats?.total_revenue || 0), icon: <TrendingUp className="text-emerald-600 dark:text-emerald-400" />, bg: 'bg-emerald-50 dark:bg-emerald-950/60', isSuccess: true },
    { label: 'إجمالي مديونيات العملاء', value: formatPriceShort(stats?.total_receivables || 0), icon: <CreditCard className="text-red-600 dark:text-red-400" />, bg: 'bg-red-50 dark:bg-red-950/60', isDanger: true },
    { label: 'مستحقات الموردين (آجل)', value: formatPriceShort(stats?.total_supplier_payables || 0), icon: <Truck className="text-orange-600 dark:text-orange-400" />, bg: 'bg-orange-50 dark:bg-orange-950/60' },
    { label: 'تحصيلات اليوم', value: formatPriceShort(stats?.today_collections || 0), icon: <Banknote className="text-emerald-600 dark:text-emerald-400" />, bg: 'bg-emerald-50 dark:bg-emerald-950/60', isSuccess: true },
    { label: 'إجمالي الطلبات', value: formatNumber(stats?.total_orders || 0), icon: <ShoppingCart className="text-blue-600 dark:text-blue-400" />, bg: 'bg-blue-50 dark:bg-blue-950/60' },
    { label: 'طلبات جديدة قيد الانتظار', value: formatNumber(stats?.pending_orders || 0), icon: <Package className="text-orange-600 dark:text-orange-400" />, bg: 'bg-orange-50 dark:bg-orange-950/60' },
    { label: 'عملاء الآجل النشطون', value: formatNumber(stats?.credit_customers || 0), icon: <Users className="text-purple-600 dark:text-purple-400" />, bg: 'bg-purple-50 dark:bg-purple-950/60' },
    { label: 'تنبيهات نواقص المخزون', value: formatNumber(stats?.low_stock_count || 0), icon: <AlertTriangle className="text-red-600 dark:text-red-400" />, bg: 'bg-red-50 dark:bg-red-950/60' },
  ];

  const recentOrdersList = Array.isArray(stats?.recent_orders) ? stats.recent_orders : [];

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">لوحة التحكم والمؤشرات الإحصائية</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">نظرة عامة على المبيعات، المديونيات، ومستحقات التوريد</p>
        </div>

        {/* Responsive Grid: 1 col on mobile, 2 on sm, 4 on lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {statCards.map((card, i) => (
            <div key={i} className={`p-4 sm:p-6 rounded-3xl border ${card.isDanger ? 'border-red-300 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/30' : card.isSuccess ? 'border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'} shadow-sm flex items-center gap-3.5 sm:gap-4`}>
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${card.bg}`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-0.5 truncate">{card.label}</p>
                <p className={`text-xl sm:text-2xl font-black font-mono truncate ${card.isDanger ? 'text-red-700 dark:text-red-400' : card.isSuccess ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">أحدث الطلبات الواردة</h2>
            <Link href="/admin/orders" className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
              <span>عرض جميع الطلبات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5 sm:p-4 whitespace-nowrap">رقم الطلب / الفاتورة</th>
                  <th className="p-3.5 sm:p-4 whitespace-nowrap">العميل / المتجر</th>
                  <th className="p-3.5 sm:p-4 whitespace-nowrap">الإجمالي</th>
                  <th className="p-3.5 sm:p-4 whitespace-nowrap">طريقة الدفع</th>
                  <th className="p-3.5 sm:p-4 whitespace-nowrap">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {recentOrdersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium text-xs">لا توجد طلبات حديثة مسجلة</td>
                  </tr>
                ) : (
                  recentOrdersList.map((order: any) => {
                    const cust = order.customer || order.profiles || {};
                    const safeId = order.invoice_no || order.order_number || (order.id ? String(order.id).slice(0, 8) : '---');
                    const safeIdClean = String(safeId).replace(/\D/g, '') || safeId;
                    const totalVal = Number(order.total !== undefined ? order.total : (order.total_amount || order.subtotal || 0));

                    return (
                      <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 sm:p-4">
                          <Link href={`/admin/orders/${order.id}`} className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline font-mono">
                            #{formatNumber(safeIdClean)}
                          </Link>
                        </td>
                        <td className="p-3.5 sm:p-4 font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{cust.store_name || cust.full_name || cust.name || 'عميل تجزئة'}</span>
                            {cust.customer_code && (
                              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                #{formatNumber(cust.customer_code)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 sm:p-4 font-bold text-slate-900 dark:text-white font-mono">{formatPriceShort(totalVal)}</td>
                        <td className="p-3.5 sm:p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            order.payment_method === 'credit'
                              ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {order.payment_method === 'credit' ? 'أجل (آجل)' : 'كاش نقدي'}
                          </span>
                        </td>
                        <td className="p-3.5 sm:p-4">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || order.status}
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
