'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { OrderStatus } from '@/lib/types';
import { Search, Eye, Filter } from 'lucide-react';
import { useNumberFormat } from '@/context/number-format-context';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'قيد الانتظار', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-300' },
  modified_by_owner: { label: 'تم التعديل', bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-800 dark:text-purple-300' },
  approved: { label: 'تمت الموافقة', bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-800 dark:text-blue-300' },
  out_for_delivery: { label: 'جاري التوصيل', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-800 dark:text-indigo-300' },
  delivering: { label: 'جاري التوصيل', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-800 dark:text-indigo-300' },
  completed: { label: 'مكتمل', bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-800 dark:text-emerald-300' },
  cancelled: { label: 'ملغي', bg: 'bg-red-100 dark:bg-red-950/60', text: 'text-red-800 dark:text-red-300' },
  returned: { label: 'مرتجع', bg: 'bg-orange-100 dark:bg-orange-950/60', text: 'text-orange-800 dark:text-orange-300' },
};

export default function AdminOrdersPage() {
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?limit=100&t=${Date.now()}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : (data.orders || data.data || []));
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const statuses = [
    { id: 'all', label: 'الكل' },
    { id: 'pending', label: 'قيد الانتظار' },
    { id: 'approved', label: 'تمت الموافقة' },
    { id: 'out_for_delivery', label: 'جاري التوصيل' },
    { id: 'completed', label: 'مكتمل' },
    { id: 'cancelled', label: 'ملغي' },
  ];

  const filteredOrders = orders.filter((order) => {
    if (filter !== 'all' && order.status !== filter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const custName = order.store_name_ref || order.customer_name || order.store_name || order.customer?.store_name || order.customer?.full_name || '';
    return (
      (order.order_number || '').toLowerCase().includes(term) ||
      (order.invoice_no || '').toLowerCase().includes(term) ||
      custName.toLowerCase().includes(term) ||
      (order.contact_phone || '').includes(term)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">إدارة الطلبات والتوريدات</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">متابعة فواتير المبيعات، الاعتماد، والتسليم لعملاء الجملة والتجزئة</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-800/60">
            
            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-thin">
              {statuses.map(s => (
                <button
                  key={s.id}
                  onClick={() => setFilter(s.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    filter === s.id 
                      ? 'bg-brand-700 text-white shadow-sm dark:bg-emerald-600' 
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم الطلب، الفاتورة، أو التاجر..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-brand-500 dark:focus:border-emerald-500 outline-none text-xs font-bold"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right bg-white dark:bg-slate-900">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-4 whitespace-nowrap">رقم الطلب / الفاتورة</th>
                  <th className="px-5 py-4 whitespace-nowrap">العميل / المتجر</th>
                  <th className="px-5 py-4 whitespace-nowrap">التاريخ</th>
                  <th className="px-5 py-4 whitespace-nowrap">طريقة الدفع</th>
                  <th className="px-5 py-4 whitespace-nowrap">الإجمالي</th>
                  <th className="px-5 py-4 whitespace-nowrap">الحالة</th>
                  <th className="px-5 py-4 whitespace-nowrap text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-500 dark:text-slate-400">جاري التحميل...</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-500 dark:text-slate-400 font-medium">لا توجد طلبات تطابق الفلتر</td></tr>
                ) : filteredOrders.map((order) => {
                  const invRaw = order.invoice_no || order.order_number || String(order.id);
                  const invClean = String(invRaw).replace(/\D/g, '') || String(order.id).slice(0, 8);
                  const totalVal = Number(order.total !== undefined && order.total !== null ? order.total : (order.total_amount || 0));

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-900 dark:text-white font-mono block">#{formatNumber(invClean)}</span>
                        {order.invoice_no && <span className="text-[11px] text-brand-600 dark:text-emerald-400 font-mono font-bold block">{order.invoice_no}</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-800 dark:text-slate-200">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {order.store_name_ref || order.customer_name || order.store_name || order.customer?.store_name || order.customer?.full_name || 'عميل تجزئة'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span dir="ltr" className="font-mono">{formatNumber(order.contact_phone || '')}</span>
                          {(order.customer?.customer_code || order.customer_code) && (
                            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              #{formatNumber(order.customer?.customer_code || order.customer_code)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300 text-xs">
                        <div className="font-medium">{new Date(order.created_at).toLocaleDateString('ar-EG')}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">{new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          order.payment_method === 'credit' 
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800' 
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {order.payment_method === 'credit' ? 'أجل (آجل)' : 'كاش'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-slate-900 dark:text-white text-base font-mono">
                        {formatPriceShort(totalVal)}
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const cfg = STATUS_CONFIG[order.status] || { label: order.status || 'قيد الانتظار', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200' };
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link href={`/admin/orders/${order.id}`} className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-emerald-500 hover:text-brand-700 dark:hover:text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-sm text-slate-800 dark:text-slate-200">
                          <Eye className="w-3.5 h-3.5 text-brand-600 dark:text-emerald-400" />
                          <span>عرض وتعديل</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
