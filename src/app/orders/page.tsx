'use client';

import { useState, useEffect } from 'react';
import { CustomerLayout } from '@/components/layout/customer-layout';
import Link from 'next/link';
import { Package, Calendar, ChevronLeft, Loader2, ShoppingCart } from 'lucide-react';
import { useNumberFormat } from '@/context/number-format-context';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  modified_by_owner: { label: 'تم التعديل (في انتظار تأكيدك)', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
  approved: { label: 'مقبول', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
  delivering: { label: 'جاري التوصيل', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
  out_for_delivery: { label: 'في الطريق إليك', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
  completed: { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  returned: { label: 'مرتجع', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { formatPriceShort, formatNumber } = useNumberFormat();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/orders?t=${Date.now()}`);
        const data = await res.json();
        if (res.ok) {
          setOrders(data.data || data.orders || []);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <CustomerLayout>
      <div className="py-8 max-w-5xl mx-auto px-4 space-y-6" dir="rtl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            سجل طلباتي وتوريداتي
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">متابعة الفواتير السابقة والحالية وتفاصيل الشحن والتسليم</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-10 h-10 text-brand-600 dark:text-emerald-400 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">لا توجد طلبات سابقة مسجلة</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto">لم تقم بإجراء أي طلبات توريد حتى الآن. يمكنك تصفح سوق الجملة واختيار بضائعك فوراً.</p>
            <Link href="/products" className="btn-primary py-3 px-8 rounded-xl font-bold inline-block text-xs">
              ابدأ طلب بضائع الجملة
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusInfo = statusMap[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-700' };
              const invNo = order.invoice_no || order.order_number || String(order.id).slice(0, 8);
              const invClean = String(invNo).replace(/\D/g, '') || invNo;
              const totalVal = Number(order.total !== undefined ? order.total : (order.total_amount || 0));

              return (
                <Link 
                  key={order.id} 
                  href={`/orders/${order.id}`}
                  className="bg-white dark:bg-slate-900 block p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:shadow-md transition-all group shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                          طلب #{formatNumber(invClean)}
                        </span>
                        <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${order.payment_method === 'credit' ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
                          {order.payment_method === 'credit' ? 'أجل' : 'كاش'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(order.created_at).toLocaleDateString('ar-EG')}
                        </span>
                        <span>•</span>
                        <span>{formatNumber(order.order_items?.length || 1)} أصناف</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                        {formatPriceShort(totalVal)}
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:group-hover:bg-emerald-950 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
