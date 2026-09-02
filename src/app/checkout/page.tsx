'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { useCart } from '@/components/cart/cart-provider';
import { useNumberFormat } from '@/context/number-format-context';
import { CheckCircle2, CreditCard, Banknote, ShieldAlert, Loader2, MapPin, Lock, Info } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart, paymentMethod, setPaymentMethod } = useCart();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  
  const [profile, setProfile] = useState<any>(null);
  const [delegateName, setDelegateName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [currentDebt, setCurrentDebt] = useState<number>(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [authRes, creditRes] = await Promise.all([
          fetch(`/api/auth/me?t=${Date.now()}`),
          fetch(`/api/credit?t=${Date.now()}`)
        ]);

        let currentProf: any = null;
        if (authRes.ok) {
          const prof = await authRes.json();
          currentProf = prof.user || prof.data || prof;
        }

        let fetchedDebt = 0;
        if (creditRes.ok) {
          const creditJson = await creditRes.json();
          if (creditJson.success) {
            fetchedDebt = Number(creditJson.current_debt || 0);
            if (!currentProf && creditJson.profile) {
              currentProf = creditJson.profile;
            }
          }
        }

        if (currentProf) {
          const debtFromProfile = currentProf.current_debt !== undefined && currentProf.current_debt !== null 
            ? Number(currentProf.current_debt) 
            : fetchedDebt;
            
          setCurrentDebt(debtFromProfile);
          setProfile(currentProf);
          setCustomerName(currentProf.store_name || currentProf.full_name || currentProf.name || '');
          setContactPhone(currentProf.phone || '');
          setDeliveryAddress(currentProf.address || '');

          const creditEnabled = Boolean(
            currentProf.credit_enabled !== false && 
            currentProf.is_credit_enabled !== false && 
            (currentProf.credit_enabled === true || currentProf.is_credit_enabled === true || (currentProf.credit_limit && currentProf.credit_limit > 0))
          );
          if (!creditEnabled) {
            setPaymentMethod('cash');
          }
        } else {
          setCurrentDebt(fetchedDebt);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [setPaymentMethod]);

  const isCreditAllowed = Boolean(
    profile &&
    profile.credit_enabled !== false &&
    profile.is_credit_enabled !== false &&
    (profile.credit_enabled === true || profile.is_credit_enabled === true || (profile.credit_limit && profile.credit_limit > 0))
  );

  const creditLimit = Number(profile?.credit_limit || 0);
  const availableCredit = Math.max(0, creditLimit - currentDebt);

  const cartSubtotal = items.reduce((sum, it) => sum + Number(it.total_price || (it.quantity * (it.unit_price || it.appliedPrice || it.product?.base_price || 0))), 0);
  const numPaid = Math.min(total, Math.max(0, Number(paidAmount || 0)));
  const remainingCredit = (paymentMethod === 'credit' && isCreditAllowed) ? Math.max(0, total - numPaid) : 0;
  const cumulativeTotal = total + currentDebt;

  const handleCheckout = async () => {
    setError('');

    if (!items || items.length === 0) {
      setError('السلة فارغة. يرجى إضافة منتجات أولاً.');
      return;
    }

    // Strict Credit Limit Validation on remaining credit amount ONLY
    if (paymentMethod === 'credit') {
      if (!isCreditAllowed) {
        setError('خاصية الشراء والدفع الآجل غير مفعلة لحسابك حالياً. يرجى اختيار الدفع نقداً عند الاستلام.');
        return;
      }

      if (remainingCredit > availableCredit) {
        setError(`عفواً، المبلغ المتبقي للآجل (${remainingCredit.toLocaleString('ar-EG')} ج.م) يتجاوز الرصيد الائتماني المتاح لك (${availableCredit.toLocaleString('ar-EG')} ج.م). الحد الائتماني المعتمد: ${creditLimit.toLocaleString('ar-EG')} ج.م والمديونية الحالية: ${currentDebt.toLocaleString('ar-EG')} ج.م.`);
        return;
      }
    }

    if (!customerName.trim()) {
      setError('يرجى إدخال اسمك الكامل أو اسم المحل/المتجر.');
      return;
    }

    const cleanPhone = contactPhone.trim();
    if (!cleanPhone) {
      setError('يرجى إدخال رقم الهاتف الأساسي للتواصل.');
      return;
    }

    const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;
    if (!egyptianPhoneRegex.test(cleanPhone)) {
      setError('رقم الهاتف الأساسي غير صحيح! يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.');
      return;
    }

    if (secondaryPhone.trim() && !egyptianPhoneRegex.test(secondaryPhone.trim())) {
      setError('رقم الهاتف الإضافي غير صحيح! يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError('يرجى كتابة عنوان التوصيل بالتفصيل (المحافظة / المركز / الشارع).');
      return;
    }

    setSubmitting(true);

    try {
      const orderData = {
        customer_id: profile?.id,
        customer_code: profile?.customer_code,
        previous_balance: currentDebt,
        current_debt: currentDebt,
        customer_name: customerName.trim(),
        store_name: profile?.store_name || customerName.trim(),
        contact_phone: cleanPhone,
        secondary_phone: secondaryPhone.trim() || undefined,
        delivery_address: deliveryAddress.trim(),
        customer_notes: customerNotes.trim() || undefined,
        delegate_name: delegateName.trim() || undefined,
        payment_method: paymentMethod,
        paid_amount: paymentMethod === 'credit' ? numPaid : total,
        remaining_amount: remainingCredit,
        total: total,
        total_amount: total,
        items: items.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.appliedPrice || item.product.base_price,
          total_price: (item.appliedPrice || item.product.base_price) * item.quantity,
          wholesale_unit: item.product.wholesale_unit || item.product.unit || 'عبوة'
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        router.push('/login?redirect=/checkout');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة مرة أخرى.');
      }

      clearCart();
      const targetOrderId = data.id || data.order_id || data.data?.id || data.order?.id;
      if (targetOrderId) {
        router.push(`/orders/${targetOrderId}`);
      } else {
        router.push('/orders');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'حدث خطأ غير متوقع أثناء إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto py-6 px-4 space-y-6" dir="rtl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">إتمام طلب التوريد</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تأكيد بيانات المنشأة ومقر التسليم واختيار طريقة السداد</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="font-black text-base mb-4 text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <span>ملخص الطلب ({formatNumber(items.length)} أصناف)</span>
            <span className="text-xs font-mono font-normal text-slate-400">الفرماوي جروب</span>
          </h2>

          {items.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm py-4 text-center">السلة فارغة حالياً</p>
          ) : (
            <>
              <div className="space-y-3 mb-4 divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, i) => (
                  <div key={item.product_id || i} className="flex justify-between text-sm items-center pt-2">
                    <div>
                      <span className="text-slate-900 dark:text-slate-100 font-bold block">{item.product?.name || 'منتج'}</span>
                      <span className="text-slate-500 dark:text-slate-400 text-xs">
                        {formatNumber(item.quantity)} {item.product?.wholesale_unit || item.product?.unit || 'عبوة'} × {formatPriceShort(item.appliedPrice || item.product?.base_price || 0)}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white text-base font-mono">
                      {formatPriceShort(item.total_price || (item.quantity * (item.appliedPrice || item.unit_price)))}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span className="font-medium">إجمالي مشتريات السلة الحالية:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{formatPriceShort(cartSubtotal || total)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="font-medium">تكلفة الشحن والتوصيل:</span>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    يُحدد لاحقاً (حسب المسافة والكمية)
                  </span>
                </div>
                {currentDebt > 0 && (
                  <div className="flex justify-between text-red-700 dark:text-red-400 font-bold bg-red-50/60 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50">
                    <span>+ مديونية حالية مسجلة على حسابك:</span>
                    <span className="font-black font-mono">{formatPriceShort(currentDebt)}</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  ℹ️ مصاريف النقل تحدد وتؤكد هاتفياً مع المندوب وفقاً للمسافة ونوع البضاعة.
                </p>
                <div className="flex justify-between items-center pt-3 border-t-2 border-slate-200 dark:border-slate-700">
                  <span className="font-black text-slate-900 dark:text-white text-base">إجمالي الحساب التراكمي المطلوب:</span>
                  <span className="text-2xl font-black text-brand-700 dark:text-emerald-400 font-mono">{formatPriceShort(cumulativeTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mandatory Customer & Delivery Details */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="font-black text-base text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            بيانات المنشأة ومقر التسليم *
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الاسم الكامل / اسم المحل والمتجر *</label>
              <input 
                type="text" 
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: سوبرماركت الأمانة / أحمد محمد"
                className="w-full p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رقم الهاتف الأساسي للتواصل (11 رقم) *</label>
              <input 
                type="tel" 
                required
                maxLength={11}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="010XXXXXXXX"
                dir="ltr"
                className="w-full p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رقم هاتف إضافي (اختياري)</label>
              <input 
                type="tel" 
                maxLength={11}
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="012XXXXXXXX"
                dir="ltr"
                className="w-full p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم المندوب المتابع (اختياري)</label>
              <input 
                type="text" 
                value={delegateName}
                onChange={(e) => setDelegateName(e.target.value)}
                placeholder="اسم المندوب أو خط السير"
                className="w-full p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">العنوان التفصيلي (المحافظة / المركز / الشارع) *</label>
            <textarea 
              required
              rows={2}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="مثال: الشرقية - الزقازيق - شارع الجلاء بجوار مسجد الفتح"
              className="w-full p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">ملاحظات وتفاصيل إضافية للطلب (اختياري)</label>
            <textarea 
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="اكتب أي ملاحظات بخصوص مواعيد الاستلام أو تفاصيل الشحن..."
              className="w-full p-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            ></textarea>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            طريقة الدفع والتسديد
          </h2>

          <div className="space-y-3">
            <label 
              onClick={() => setPaymentMethod('cash')}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'cash' 
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 shadow-sm' 
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <input 
                type="radio" 
                name="payment_method" 
                value="cash" 
                checked={paymentMethod === 'cash'} 
                onChange={() => setPaymentMethod('cash')}
                className="w-4 h-4 text-emerald-600"
              />
              <Banknote className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <span className="font-black text-sm block">دفع كاش نقداً عند الاستلام</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">تسليم المبلغ كاملاً لمندوب وسائق السيارة عند تفريغ البضاعة</span>
              </div>
            </label>

            {isCreditAllowed ? (
              <label 
                onClick={() => setPaymentMethod('credit')}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  paymentMethod === 'credit' 
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 shadow-sm' 
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input 
                  type="radio" 
                  name="payment_method" 
                  value="credit" 
                  checked={paymentMethod === 'credit'} 
                  onChange={() => setPaymentMethod('credit')}
                  className="w-4 h-4 text-orange-600"
                />
                <CreditCard className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                <div className="flex-1">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <span className="font-black text-sm block">دفع آجل (حساب تاجر معتمد)</span>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      رصيد متاح: {formatPriceShort(availableCredit)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                    الحد الائتماني: {formatPriceShort(creditLimit)} — المديونية الحالية: {formatPriceShort(currentDebt)}
                  </span>
                </div>
              </label>
            ) : (
              <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                    <Lock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <span>الدفع الآجل (غير مفعل)</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-semibold">مغلق</span>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      خاصية الآجل غير مفعلة لحسابك، يرجى التواصل مع إدارة الفرماوي جروب لتفعيل الحد الائتماني
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {paymentMethod === 'credit' && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  المبلغ المدفوع كاش الآن (عربون أو دفعة تحت الحساب)
                </label>
                <input 
                  type="number" 
                  min="0"
                  max={total}
                  step="50"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-between items-center pt-2 text-xs font-bold border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">المبلغ المتبقي الذي سيُرحل للأجل:</span>
                <span className="text-orange-700 dark:text-orange-400 font-mono text-sm">{formatPriceShort(remainingCredit)}</span>
              </div>

              {remainingCredit > availableCredit && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                  <span>
                    المتبقي الآجل ({formatPriceShort(remainingCredit)}) أكبر من الرصيد المتاح لك ({formatPriceShort(availableCredit)}). يرجى زيادة الدفعة الكاش.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleCheckout}
          disabled={submitting || items.length === 0}
          className="w-full btn-primary py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري تسجيل وتأكيد الطلب...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>تأكيد وإرسال طلب التوريد ({formatPriceShort(total)})</span>
            </>
          )}
        </button>
      </div>
    </CustomerLayout>
  );
}
