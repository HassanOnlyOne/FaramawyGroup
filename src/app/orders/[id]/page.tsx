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
      const [res, creditRes] = await Promise.all([
        fetch(`/api/orders/${id}?t=${Date.now()}`),
        fetch(`/api/credit?t=${Date.now()}`)
      ]);

      const data = await res.json();
      const fetchedOrder = data.data || data.order || (data.id ? data : null);

      if (creditRes.ok) {
        const creditJson = await creditRes.json();
        if (creditJson.success) {
          const prof = creditJson.profile || fetchedOrder?.customer || {};
          setProfile({
            ...prof,
            current_debt: creditJson.current_debt !== undefined ? Number(creditJson.current_debt) : Number(prof.current_debt || 0),
            credit_limit: creditJson.credit_limit !== undefined ? Number(creditJson.credit_limit) : Number(prof.credit_limit || 0),
            is_credit_enabled: creditJson.is_credit_enabled ?? prof.is_credit_enabled ?? prof.credit_enabled ?? true
          });
        }
      } else if (fetchedOrder?.customer) {
        setProfile(fetchedOrder.customer);
      }

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
  const maxAllowedCreditForOrder = baseAvailableCredit + currentOrderRemaining;
  const isOverCreditLimit = isCredit && newRemainingCredit > maxAllowedCreditForOrder;

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

    if (isCredit && newRemainingCredit > maxAllowedCreditForOrder) {
      toast({ 
        title: 'تجاوز الحد الائتماني المسموح', 
        description: `المتبقي الآجل (${formatPriceShort(newRemainingCredit)}) يتجاوز رصيدك الائتماني المتاح (${formatPriceShort(maxAllowedCreditForOrder)})`, 
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
        payment_method: editablePaymentMethod,
        status: 'pending'
      };

      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json().catch(() => ({}));

      if (res.ok && resData.success !== false) {
        toast({ title: 'تم حفظ وتحديث الطلب بنجاح', description: 'تم تحديث أصناف الفاتورة وطريقة السداد والإجمالي الجديد', type: 'success' });
        setShowEditModal(false);
        await fetchOrder();
        router.refresh();
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
        body: JSON.stringify({ status: 'cancelled' })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم إلغاء الطلب', description: 'تم تحويل حالة الطلب إلى ملغي بنجاح', type: 'success' });
        await fetchOrder();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل إلغاء الطلب', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

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

  const isPending = order.status === 'pending';
  const statusInfo = statusMap[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-700' };
  const invNo = order.invoice_no || order.order_number || String(order.id).slice(0, 8);
  const invClean = String(invNo).replace(/\D/g, '') || invNo;
  const totalVal = Number(order.total !== undefined ? order.total : (order.total_amount || 0));
  const paidVal = Number(order.paid_amount || 0);
  const remVal = Number(order.remaining_amount !== undefined ? order.remaining_amount : Math.max(0, totalVal - paidVal));

  const filteredProductsToAdd = availableProducts.filter(p => {
    if (!productSearch.trim()) return false;
    const term = productSearch.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.sku_code || '').includes(term) ||
      (p.sku || '').toLowerCase().includes(term)
    );
  });

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

        {/* Customer Self-Edit / Cancel Action Bar for Pending Orders */}
        {isPending ? (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200">الطلب قيد المراجعة ويمكنك تعديله</h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  يمكنك تعديل الكميات، طريقة السداد، إضافة أو حذف أصناف قبل اعتماد الطلب
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleOpenEditModal}
                className="flex-1 sm:flex-none btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-sm"
              >
                <Edit3 className="w-4 h-4" />
                <span>تعديل الطلب</span>
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/40 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>{isCancelling ? 'جاري الإلغاء...' : 'إلغاء الطلب'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>لا يمكن تعديل الطلب أو إلغاؤه بعد اعتماده أو تجهيزه للتوصيل.</span>
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
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">أصناف الفاتورة</h2>
                {isPending && (
                  <button
                    onClick={handleOpenEditModal}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل الأصناف وطريقة السداد</span>
                  </button>
                )}
              </div>
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

      {/* Enhanced Customer Edit Order Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  تعديل أصناف وطريقة سداد الطلب #{formatNumber(invClean)}
                </h3>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
              
              {/* Product Search & Add Section */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  إضافة منتج جديد للطلب:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو كود الصنف لإضافته..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>

                {productSearch.trim() && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredProductsToAdd.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">لا توجد منتجات مطابقة للبحث</div>
                    ) : (
                      filteredProductsToAdd.map(prod => (
                        <div
                          key={prod.id}
                          onClick={() => handleAddProduct(prod)}
                          className="p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer transition-colors flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white block">{prod.name}</span>
                            <span className="text-[11px] text-slate-400">الوحدة: {prod.wholesale_unit || prod.unit || 'عبوة'}</span>
                          </div>
                          <div className="text-left flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                              {formatPriceShort(prod.base_price || prod.price || 0)}
                            </span>
                            <span className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-0.5">
                              <Plus className="w-3 h-3" /> إضافة
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">الأصناف في الطلب ({editableItems.length})</h4>
                <div className="space-y-2.5">
                  {editableItems.map(item => (
                    <div 
                      key={item.product_id || item.id}
                      className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap"
                    >
                      <div className="flex-1 min-w-[150px]">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">{item.name}</span>
                        <span className="text-[11px] text-slate-400">
                          سعر {item.wholesale_unit}: {formatPriceShort(item.unit_price)}
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.product_id || item.id, -1)}
                          disabled={item.quantity <= (item.min_order_quantity || 1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {formatNumber(item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.product_id || item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Total Item Price */}
                      <div className="text-left font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white min-w-[70px]">
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
                        <span>المتبقي الآجل ({formatPriceShort(newRemainingCredit)}) يتجاوز رصيدك الائتماني المتاح ({formatPriceShort(maxAllowedCreditForOrder)}). يرجى زيادة الدفعة الكاش.</span>
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
