'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CustomerLayout } from '@/components/layout/customer-layout';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { Package, ArrowRight, Loader2, MapPin, Phone, StickyNote, AlertTriangle, MessageSquare, CreditCard, Banknote } from 'lucide-react';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { useNumberFormat } from '@/context/number-format-context';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  modified_by_owner: { label: 'تم التعديل (في انتظار تأكيدك)', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
  approved: { label: 'مقبول وجاري التجهيز', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
  delivering: { label: 'في الطريق', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
  out_for_delivery: { label: 'في الطريق إليك', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
  completed: { label: 'مكتمل ومستلم', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  returned: { label: 'مرتجع', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const { formatPriceShort, formatNumber } = useNumberFormat();

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        const fetchedOrder = data.data || data.order || (data.id ? data : null);

        if (res.ok && fetchedOrder) {
          setOrder(fetchedOrder);
        } else {
          toast({ title: 'خطأ', description: 'الطلب غير موجود', type: 'error' });
          router.push('/orders');
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id, router, toast]);

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
        </div>
      </CustomerLayout>
    );
  }

  if (!order) return null;

  const statusInfo = statusMap[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-700' };
  const invNo = order.invoice_no || order.order_number || String(order.id).slice(0, 8);
  const invClean = String(invNo).replace(/\D/g, '') || invNo;
  const totalVal = Number(order.total !== undefined ? order.total : (order.total_amount || 0));
  const paidVal = Number(order.paid_amount || 0);
  const remVal = Number(order.remaining_amount !== undefined ? order.remaining_amount : Math.max(0, totalVal - paidVal));

  return (
    <CustomerLayout>
      <div className="py-4 sm:py-8 max-w-5xl mx-auto px-3 sm:px-4 space-y-4 sm:space-y-6 pb-28" dir="rtl">
        <Link href="/orders" className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-bold">
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة طلباتي</span>
        </Link>

        {order.status === 'modified_by_owner' && (
          <div className="bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-3xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 shadow-sm">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-purple-900 dark:text-purple-200 mb-0.5">تم تعديل الطلب من قبل الإدارة</h3>
              <p className="text-purple-700 dark:text-purple-300 text-xs">
                لقد قمنا بتحديث بنود الفاتورة أو الأسعار. يرجى مراجعة التفاصيل أدناه.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <div className="w-full lg:w-2/3 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap justify-between items-center gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
                  <span>فاتورة طلب #{formatNumber(invClean)}</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                  بتاريخ {new Date(order.created_at).toLocaleDateString('ar-EG')} - {new Date(order.created_at).toLocaleTimeString('ar-EG')}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full font-bold text-xs ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-3">حالة ومسار التوريد</h2>
              <OrderTimeline currentStatus={order.status} updatedAt={order.updated_at || order.created_at} />
            </div>

            {/* Order Items */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-3">أصناف الفاتورة</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {order.order_items?.map((item: any, idx: number) => {
                  const prod = item.product || {};
                  return (
                    <div key={item.id || idx} className="py-3 sm:py-3.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-xs sm:text-sm">{prod.name || item.product_name || 'صنف غذائي'}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">
                          {formatNumber(item.quantity)} {prod.wholesale_unit || prod.unit || item.wholesale_unit || 'عبوة'} × {formatPriceShort(item.unit_price)}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white font-mono text-xs sm:text-sm whitespace-nowrap">
                        {formatPriceShort(item.total_price || (item.quantity * item.unit_price))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Summary */}
          <div className="w-full lg:w-1/3 space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                الحساب والمدفوعات
              </h3>
              
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {order.payment_method === 'credit' ? 'أجل (آجل)' : 'كاش نقدي'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>إجمالي الفاتورة:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{formatPriceShort(totalVal)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>المسدد نقداً:</span>
                  <span className="font-bold font-mono">{formatPriceShort(paidVal)}</span>
                </div>
                {remVal > 0 && (
                  <div className="flex justify-between text-orange-700 dark:text-orange-400 font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>المتبقي في حساب الأجل:</span>
                    <span className="font-mono text-sm">{formatPriceShort(remVal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Details */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                بيانات التسليم
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span dir="ltr" className="font-mono font-bold">{formatNumber(order.contact_phone || '')}</span>
                </div>
                <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-orange-600 mt-0.5 shrink-0" />
                  <span>{order.delivery_address || 'المخزن الرئيسي'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
