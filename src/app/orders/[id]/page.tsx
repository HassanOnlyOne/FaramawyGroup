'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CustomerLayout } from '@/components/layout/customer-layout';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { 
  Package, 
  ArrowRight, 
  Loader2, 
  MapPin, 
  Phone, 
  AlertTriangle, 
  Edit3, 
  XCircle, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Check, 
  Info,
  ShoppingCart,
  Banknote,
  CreditCard,
  ShieldAlert
} from 'lucide-react';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { useNumberFormat } from '@/context/number-format-context';
import { createClient } from '@/lib/supabase/client';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  modified_by_owner: { label: 'تم التعديل (في انتظار تأكيدك)', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
  approved: { label: 'مقبول وجاري التجهيز', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
  processing: { label: 'جاري التجهيز', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
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
  const [profile, setProfile] = useState<any>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { formatPriceShort, formatNumber } = useNumberFormat();

  // Edit Order Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [editablePaymentMethod, setEditablePaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [editablePaidAmount, setEditablePaidAmount] = useState<string>('0');
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${id}?t=${Date.now()}`);
      const data = await res.json();
      const fetchedOrder = data.data || data.order || (data.id ? data : null);

      if (res.ok && fetchedOrder) {
        setOrder(fetchedOrder);
        
        // Fetch fresh profile directly from profiles table
        const customerId = fetchedOrder.customer_id || fetchedOrder.customer?.id;
        let freshProfile = fetchedOrder.customer;

        if (customerId) {
          try {
            const supabase = createClient();
            const { data: p } = await supabase
              .from('profiles')
              .select('id, full_name, store_name, credit_limit, current_debt, is_credit_enabled, credit_enabled')
              .eq('id', customerId)
              .maybeSingle();
            if (p) {
              freshProfile = p;
            }
          } catch (e) {
            console.error('Direct profile fetch error:', e);
          }
        }

        if (freshProfile) {
          setProfile({
            ...freshProfile,
            current_debt: Number(freshProfile.current_debt || 0),
            credit_limit: Number(freshProfile.credit_limit || 0),
            is_credit_enabled: freshProfile.is_credit_enabled ?? freshProfile.credit_enabled ?? true
          });
        }
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

  useEffect(() => {
    fetchOrder();
  }, [id]);

  // Load active products when opening edit modal
  const handleOpenEditModal = async () => {
    if (!order || order.status !== 'pending') return;

    // Initialize editable items from current order
    const initialItems = (order.order_items || []).map((item: any) => ({
      id: item.product_id || item.id,
      product_id: item.product_id || item.product?.id || item.id,
      name: item.product?.name || item.product_name || 'صنف غذائي',
      wholesale_unit: item.product?.wholesale_unit || item.product?.unit || item.wholesale_unit || 'عبوة',
      unit_price: Number(item.unit_price || item.price || 0),
      quantity: Number(item.quantity || 1),
      min_order_quantity: item.product?.min_order_quantity || 1
    }));
    setEditableItems(initialItems);
    setEditablePaymentMethod(order.payment_method === 'credit' ? 'credit' : 'cash');
    setEditablePaidAmount(String(order.paid_amount || 0));
    setShowEditModal(true);

    try {
      const prodRes = await fetch(`/api/products?limit=200&t=${Date.now()}`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const prods = prodData.products || prodData.data || [];
        setAvailableProducts(prods.filter((p: any) => p.is_active !== false));
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setEditableItems(prev => prev.map(item => {
      if (item.product_id === productId || item.id === productId) {
        const minQty = item.min_order_quantity || 1;
        const newQty = Math.max(minQty, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleRemoveItem = (productId: string) => {
    if (editableItems.length <= 1) {
      toast({ title: 'تنبيه', description: 'يجب أن تحتوي الفاتورة على صنف واحد على الأقل', type: 'error' });
      return;
    }
    setEditableItems(prev => prev.filter(item => (item.product_id || item.id) !== productId));
  };

  const handleAddProduct = (prod: any) => {
    const existing = editableItems.find(item => (item.product_id || item.id) === prod.id);
    if (existing) {
      handleQuantityChange(prod.id, 1);
      toast({ title: 'تمت زيادة الكمية', description: `تمت زيادة كمية ${prod.name}`, type: 'success' });
    } else {
      const newItem = {
        id: prod.id,
        product_id: prod.id,
        name: prod.name,
        wholesale_unit: prod.wholesale_unit || prod.unit || 'عبوة',
        unit_price: Number(prod.base_price || prod.price || 0),
        quantity: Number(prod.min_order_quantity || 1),
        min_order_quantity: Number(prod.min_order_quantity || 1)
      };
      setEditableItems(prev => [...prev, newItem]);
      toast({ title: 'تمت إضافة الصنف', description: `تمت إضافة ${prod.name} إلى الفاتورة`, type: 'success' });
    }
    setProductSearch('');
  };

  // Real-time calculations for Edit Modal
  const editModalSubtotal = editableItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const newTotal = editModalSubtotal;
  const isCredit = editablePaymentMethod === 'credit';
  const newCashPaid = editablePaymentMethod === 'cash' 
    ? newTotal 
    : Math.min(newTotal, Math.max(0, Number(editablePaidAmount || 0)));
  const newRemainingCredit = isCredit 
    ? Math.max(0, newTotal - newCashPaid) 
    : 0;

  // Strict Credit Calculations
  const currentDebt = Number(profile?.current_debt) || 0;
  const creditLimit = Number(profile?.credit_limit) || 0;
  
  // Free available credit in merchant account (e.g. 5,000 - 3,000 = 2,000 EGP)
  const baseAvailableCredit = Math.max(0, creditLimit - currentDebt);
  
  // Max allowed credit for this order being edited
  const currentOrderRemaining = Number(order?.remaining_amount !== undefined ? order.remaining_amount : (order?.payment_method === 'credit' ? Math.max(0, Number(order?.total || 0) - Number(order?.paid_amount || 0)) : 0));
  const maxCreditForThisOrder = baseAvailableCredit + currentOrderRemaining;
  const isOverCreditLimit = isCredit && newRemainingCredit > maxCreditForThisOrder;

  const isCreditAllowedForCustomer = Boolean(
    profile?.is_credit_enabled !== false && 
    profile?.credit_enabled !== false && 
    creditLimit > 0
  );

  const handleSaveOrderEdit = async () => {
    if (editableItems.length === 0) {
      toast({ title: 'تنبيه', description: 'الطلب يجب أن يحتوي على أصناف', type: 'error' });
      return;
    }

    if (isCredit && !isCreditAllowedForCustomer) {
      toast({ title: 'الدفع الآجل غير مفعل', description: 'خاصية الشراء بالآجل غير مفعلة لحسابك. يرجى اختيار الدفع كاش.', type: 'error' });
      return;
    }

    if (isCredit && newRemainingCredit > maxCreditForThisOrder) {
      toast({ 
        title: 'تجاوز الحد الائتماني المسموح', 
        description: `المتبقي الآجل (${formatPriceShort(newRemainingCredit)}) يتجاوز الحد المتاح لك (${formatPriceShort(maxCreditForThisOrder)}). يرجى زيادة الدفعة الكاش.`, 
        type: 'error' 
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      const payload = {
        items: editableItems.map(item => ({
          product_id: item.product_id || item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        })),
        subtotal: newTotal,
        total: newTotal,
        total_amount: newTotal,
        paid_amount: newCashPaid,
        remaining_amount: newRemainingCredit,
        payment_method: newRemainingCredit > 0 ? 'credit' : 'cash',
        status: 'pending'
      };

      const res = await fetch(`/api/orders/${order.id || id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json().catch(() => ({}));

      if (res.ok && resData.success !== false) {
        setShowEditModal(false);
        toast({ title: 'تم حفظ وتحديث الطلب بنجاح', description: 'تم تحديث أصناف الفاتورة والمبالغ وطريقة السداد', type: 'success' });
        await fetchOrder();
        router.refresh();
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }
      } else {
        toast({ title: 'خطأ في التعديل', description: resData.error || 'فشل حفظ التعديلات', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelOrder = async () => {
    const confirmed = window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟');
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (res.ok) {
        toast({ title: 'تم إلغاء الطلب', description: 'تم تحديث حالة الطلب إلى ملغي بنجاح', type: 'success' });
        await fetchOrder();
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: 'خطأ', description: data.error || 'فشل إلغاء الطلب', type: 'error' });
      }
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'فشل إلغاء الطلب', type: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </CustomerLayout>
    );
  }

  if (!order) return null;

  const canEdit = order.status === 'pending';
  const orderItems = order.order_items || [];
  const statusInfo = statusMap[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-800' };

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6" dir="rtl">
        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowRight className="w-4 h-4" />
            <span>العودة لكل الطلبات</span>
          </Link>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <button
                  onClick={handleOpenEditModal}
                  className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/80 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل الطلب</span>
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>إلغاء الطلب</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Order Header Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  فاتورة توريد #{formatNumber(order.invoice_no || order.order_number)}
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                تاريخ التسجيل: {new Date(order.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="text-right sm:text-left">
              <span className="text-xs text-slate-400 block mb-0.5">إجمالي قيمة الفاتورة</span>
              <span className="text-2xl sm:text-3xl font-black text-brand-700 dark:text-emerald-400 font-mono">
                {formatPriceShort(order.total || order.total_amount || 0)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="pt-6">
            <OrderTimeline currentStatus={order.status} />
          </div>
        </div>

        {/* Order Details & Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Items List (2 cols) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                أصناف وبضاعة الطلب ({formatNumber(orderItems.length)})
              </h2>
              {canEdit && (
                <button
                  onClick={handleOpenEditModal}
                  className="text-xs text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل الكميات والأصناف</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {orderItems.map((item: any, i: number) => {
                const prod = item.product || {};
                const unitPrice = Number(item.unit_price || item.price || 0);
                const qty = Number(item.quantity || 1);
                const totalLine = Number(item.total_price || (qty * unitPrice));
                const unit = prod.wholesale_unit || prod.unit || item.wholesale_unit || 'عبوة';

                return (
                  <div key={item.id || i} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-black text-xs shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                          {prod.name || item.product_name || 'صنف غذائي'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatNumber(qty)} {unit} × {formatPriceShort(unitPrice)}
                        </p>
                      </div>
                    </div>
                    <div className="text-left font-mono font-black text-slate-900 dark:text-white text-base">
                      {formatPriceShort(totalLine)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial Totals Breakdown */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>قيمة البضاعة (المجموع الفرعي):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">
                  {formatPriceShort(order.subtotal || order.total || 0)}
                </span>
              </div>

              {Number(order.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>خصم تجاري:</span>
                  <span className="font-mono text-sm">-{formatPriceShort(order.discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>مصاريف الشحن والنقل:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">
                  {Number(order.delivery_fee || 0) > 0 ? formatPriceShort(order.delivery_fee) : 'يحدد لاحقاً'}
                </span>
              </div>

              <div className="flex justify-between text-slate-900 dark:text-white font-black text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>إجمالي الفاتورة:</span>
                <span className="text-base text-brand-700 dark:text-emerald-400 font-mono">
                  {formatPriceShort(order.total || order.total_amount || 0)}
                </span>
              </div>

              <div className="flex justify-between text-slate-700 dark:text-slate-300 font-bold pt-1">
                <span>طريقة السداد:</span>
                <span>{order.payment_method === 'credit' ? 'أجل (حساب تاجر معتمد)' : 'كاش نقداً عند الاستلام'}</span>
              </div>

              {order.payment_method === 'credit' && (
                <>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>المبلغ المسدد كاش:</span>
                    <span className="font-mono font-bold text-emerald-600">{formatPriceShort(order.paid_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-orange-700 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-950/40 p-2 rounded-xl border border-orange-200 dark:border-orange-900/50">
                    <span>المتبقي الآجل على الحساب:</span>
                    <span className="font-mono font-black">{formatPriceShort(order.remaining_amount !== undefined ? order.remaining_amount : Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0)))}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Delivery & Customer Info (1 col) */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-black text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                مقر التسليم وبيانات التواصل
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">اسم المنشأة / العميل:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {order.customer?.store_name || order.store_name_ref || order.customer_name || order.customer?.full_name || 'عميل المتجر'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">رقم الهاتف:</span>
                  <a href={`tel:${order.contact_phone}`} className="font-bold font-mono text-brand-600 hover:underline flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{order.contact_phone || '---'}</span>
                  </a>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">عنوان التوصيل:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {order.delivery_address || '---'}
                  </p>
                </div>

                {order.customer_notes && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block mb-0.5 font-bold">ملاحظات الطلب:</span>
                    <p className="text-slate-700 dark:text-slate-300 italic">{order.customer_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Order Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-in my-auto" dir="rtl">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850 rounded-t-3xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">تعديل طلب التوريد #{formatNumber(order.invoice_no || order.order_number)}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">تعديل كميات الأصناف، إضافة أصناف جديدة، أو تغيير طريقة السداد</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Product Search & Add Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">إضافة صنف جديد للطلب:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ابحث باسم المنتج أو الصنف للإضافة..."
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>

                {productSearch.trim() && (
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md">
                    {availableProducts
                      .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                      .slice(0, 10)
                      .map(p => (
                        <div key={p.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white block">{p.name}</span>
                            <span className="text-[10px] text-slate-400">سعر {p.wholesale_unit || p.unit || 'الوحدة'}: {formatPriceShort(p.base_price || p.price)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddProduct(p)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1 text-[11px] shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>إضافة</span>
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Editable Items List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">أصناف الفاتورة الحالية:</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {editableItems.map((item, idx) => (
                    <div 
                      key={item.product_id || item.id || idx}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatPriceShort(item.unit_price)} / {item.wholesale_unit || 'عبوة'}
                        </p>
                      </div>

                      {/* Quantity Control */}
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.product_id || item.id, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-bold font-mono text-slate-900 dark:text-white">
                          {formatNumber(item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.product_id || item.id, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="text-left font-mono font-black text-slate-900 dark:text-white w-20">
                        {formatPriceShort(item.quantity * item.unit_price)}
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.product_id || item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector in Edit Modal */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">طريقة السداد للطلب:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label 
                    onClick={() => setEditablePaymentMethod('cash')}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                      editablePaymentMethod === 'cash' 
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="edit_pm" 
                      value="cash" 
                      checked={editablePaymentMethod === 'cash'} 
                      onChange={() => setEditablePaymentMethod('cash')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="font-bold text-xs block">سداد كاش بالكامل</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">بدون إضافة أي مديونية للآجل</span>
                    </div>
                  </label>

                  {isCreditAllowedForCustomer ? (
                    <label 
                      onClick={() => setEditablePaymentMethod('credit')}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                        editablePaymentMethod === 'credit' 
                          ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200' 
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="edit_pm" 
                        value="credit" 
                        checked={editablePaymentMethod === 'credit'} 
                        onChange={() => setEditablePaymentMethod('credit')}
                        className="w-4 h-4 text-orange-600"
                      />
                      <CreditCard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <div>
                        <span className="font-bold text-xs block">دفع آجل (حساب تاجر)</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">رصيد ائتماني متاح: {formatPriceShort(baseAvailableCredit)}</span>
                      </div>
                    </label>
                  ) : (
                    <div className="p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 opacity-60 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-slate-400" />
                      <span className="text-xs text-slate-500">الآجل غير مفعل لحسابك</span>
                    </div>
                  )}
                </div>

                {editablePaymentMethod === 'credit' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      المبلغ المدفوع كاش الآن (عربون أو دفعة تحت الحساب):
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      max={newTotal}
                      step="50"
                      value={editablePaidAmount}
                      onChange={e => setEditablePaidAmount(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                    <div className="flex justify-between items-center text-xs font-bold pt-1">
                      <span className="text-slate-600 dark:text-slate-400">المبلغ المتبقي الذي سيرحل للآجل:</span>
                      <span className="text-orange-700 dark:text-orange-400 font-mono text-sm">{formatPriceShort(newRemainingCredit)}</span>
                    </div>

                    {isOverCreditLimit && (
                      <div className="p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                        <span>المتبقي الآجل ({formatPriceShort(newRemainingCredit)}) يتجاوز الحد المتاح لك ({formatPriceShort(maxCreditForThisOrder)}). يرجى زيادة الدفعة الكاش.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Total Calculation Summary */}
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex justify-between items-center">
                <span className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200">
                  إجمالي الطلب المعدل:
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatPriceShort(newTotal)}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex gap-2">
              <button
                type="button"
                disabled={isSavingEdit || editableItems.length === 0 || isOverCreditLimit}
                onClick={handleSaveOrderEdit}
                className="flex-1 btn-primary py-3 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ التعديلات...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>حفظ التعديلات وتحديث الطلب</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="btn-secondary px-5 py-3 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}
