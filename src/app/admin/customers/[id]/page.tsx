'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { ArrowRight, DollarSign, Printer, Loader2, Phone, FileText } from 'lucide-react';
import { useNumberFormat } from '@/context/number-format-context';
import { BRAND } from '@/lib/constants';

export default function CustomerLedgerPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();

  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editCreditEnabled, setEditCreditEnabled] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    fetchCustomerData();
  }, [id]);

  async function fetchCustomerData() {
    try {
      // جلب داتا العميل، الفواتير، وكل السندات العامة بـ API موحد ومباشر
      const [custRes, ordersRes, paymentsRes] = await Promise.all([
        fetch(`/api/admin/customers/${id}?t=${Date.now()}`),
        fetch(`/api/orders?limit=200&t=${Date.now()}`),
        fetch(`/api/payments?t=${Date.now()}`)
      ]);

      let prof: any = null;
      if (custRes.ok) {
        const custData = await custRes.json();
        prof = custData.data || custData.profile;
      }
      if (!prof) {
        const fbRes = await fetch(`/api/customers/${id}?t=${Date.now()}`);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          prof = fbData.data || fbData.profile;
        }
      }

      if (prof) {
        setCustomer(prof);
        setEditCreditLimit(String(prof.credit_limit || 0));
        const enabled = prof.is_credit_enabled !== undefined ? Boolean(prof.is_credit_enabled) : (prof.credit_enabled !== false);
        setEditCreditEnabled(enabled);
      }

      let allOrders: any[] = [];
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        allOrders = Array.isArray(ordersData) ? ordersData : (ordersData.data || ordersData.orders || []);
      }

      const custCode = prof ? String(prof.customer_code || '').replace(/\D/g, '') : '';
      const matchedOrders = allOrders.filter((o: any) => 
        String(o.customer_id) === String(id) ||
        String(o.customer?.id) === String(id) ||
        (custCode && (String(o.customer_code) === custCode || String(o.store_code) === custCode))
      );
      setOrders(matchedOrders);

      // جلب وعرض كل سندات هذا العميل بدقة تامة لتظهر في الجدول
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        const allPayments = Array.isArray(paymentsData) ? paymentsData : (paymentsData.data || paymentsData.payments || []);
        const matchedPayments = allPayments.filter((p: any) => {
          const pCustId = String(p.customer_id || p.customer?.id || '');
          const pCode = String(p.customer_code || '').replace(/\D/g, '');
          return pCustId === String(id) || (custCode && pCode === custCode) || (custCode && pCode.includes(custCode));
        });
        setPayments(matchedPayments.length > 0 ? matchedPayments : allPayments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateCredit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credit_limit: Number(editCreditLimit || 0),
          is_credit_enabled: Boolean(editCreditEnabled),
          credit_enabled: Boolean(editCreditEnabled)
        })
      });
      if (res.ok) {
        toast({ title: 'تم تحديث الحد الائتماني بنجاح', type: 'success' });
        setShowCreditModal(false);
        fetchCustomerData();
      } else {
        toast({ title: 'خطأ في تحديث الحد الائتماني', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (paymentLoading) return;
    setPaymentLoading(true);

    const formData = new FormData(e.currentTarget);
    const amountVal = parseFloat(formData.get('amount') as string);
    const notesVal = (formData.get('notes') as string) || 'سداد نقدية لحساب الأجل';
    const custCode = customer?.customer_code ? String(customer.customer_code).replace(/\D/g, '') : '1004';
    
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: id,
          customer_code: custCode,
          amount: amountVal,
          payment_method: 'cash',
          notes: notesVal,
          user_name: 'المدير العام'
        })
      });
      
      if (res.ok) {
        toast({ title: 'تم تسجيل تحصيل النقدية وتحديث المديونية بنجاح', type: 'success' });
        setShowPaymentModal(false);
        await fetchCustomerData();
      } else {
        toast({ title: 'خطأ في تسجيل التحصيل', type: 'error' });
      }
    } catch (err) {
      toast({ title: 'خطأ في الاتصال', type: 'error' });
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!customer) {
    return (
      <AdminLayout>
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">العميل غير موجود</h2>
          <Link href="/admin/customers" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
            العودة لقائمة العملاء
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const custCodeClean = customer.customer_code ? String(customer.customer_code).replace(/\D/g, '') : (customer.id ? String(customer.id).slice(-4) : '1004');

  // بناء أحداث كشف الحساب (الفواتير + السندات)
  const statementEvents: any[] = [];

  orders.forEach(o => {
    if (o.status === 'pending' || o.status === 'cancelled' || o.status === 'returned') return;
    const isCredit = o.payment_method === 'credit';
    const total = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
    const paid = Number(o.paid_amount || 0);
    const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, total - paid) : 0));
    
    if (!isCredit && rem <= 0) return;

    const invNo = o.invoice_no || o.order_number || String(o.id).slice(0, 8);
    const cleanInv = String(invNo).replace(/\D/g, '') || invNo;
    const debitAmount = rem > 0 ? rem : total;

    statementEvents.push({
      date: new Date(o.created_at),
      type: 'فاتورة توريد (آجل)',
      ref: `فاتورة #${formatNumber(cleanInv)}`,
      notes: paid > 0 ? `إجمالي الفاتورة ${formatPriceShort(total)} (مسدد كاش ${formatPriceShort(paid)})` : `فاتورة توريد بضاعة لحساب الأجل`,
      debit: debitAmount,
      credit: 0,
    });
  });

  payments.forEach(p => {
    const val = Number(p.amount || 0);
    const payId = String(p.id).replace(/\D/g, '').slice(0, 6) || '1';
    statementEvents.push({
      date: new Date(p.created_at || p.payment_date),
      type: 'سند تحصيل نقدي',
      ref: `سند تحصيل #${formatNumber(payId)}`,
      notes: p.notes || 'سداد نقدية لحساب الأجل',
      debit: 0,
      credit: val,
    });
  });

  statementEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  // الحل القاطع: إجمالي الفواتير الآجلة ناقص إجمالي سندات التحصيل الظاهرة في الجدول مباشرة
  const totalDebit = statementEvents.reduce((acc, ev) => acc + (ev.debit || 0), 0);
  const totalCredit = statementEvents.reduce((acc, ev) => acc + (ev.credit || 0), 0);
  const finalUnifiedDebt = Math.max(0, totalDebit - totalCredit);

  const creditLimit = Number(customer.credit_limit || 0);
  const availableCredit = Math.max(0, creditLimit - finalUnifiedDebt);

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Top Header Card (Screen Only) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <Link href="/admin/customers" className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">{customer.store_name || customer.full_name || customer.name}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  كود العميل: #{formatNumber(custCodeClean)}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1 font-mono font-bold">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {formatNumber(customer.phone)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <button onClick={() => setShowCreditModal(true)} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow-sm cursor-pointer">
              <span>تعديل الحد الائتماني</span>
            </button>
            <button onClick={() => setShowPaymentModal(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl cursor-pointer">
              <DollarSign className="w-4 h-4" />
              <span>تسجيل تحصيل نقدية</span>
            </button>
            <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer">
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </div>

        {/* Financial Cards Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي المديونية المتبقية المستحقة</span>
            <span className="text-3xl font-black text-red-600 dark:text-red-400 font-mono">{formatPriceShort(finalUnifiedDebt)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الحد الائتماني المعتمد</span>
              <button onClick={() => setShowCreditModal(true)} className="text-[11px] text-brand-600 dark:text-emerald-400 hover:underline font-bold print:hidden">تعديل</button>
            </div>
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">{formatPriceShort(creditLimit)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">الرصيد الائتماني المتاح للشراء</span>
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatPriceShort(availableCredit)}</span>
          </div>
        </div>

        {/* Detailed Statement Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>كشف حساب تفصيلي للمسحوبات الآجلة والتحصيلات</span>
            </h2>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">عدد الحركات: {formatNumber(statementEvents.length)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">التاريخ</th>
                  <th className="p-4 whitespace-nowrap">نوع الحركة</th>
                  <th className="p-4 whitespace-nowrap">رقم المرجع</th>
                  <th className="p-4 whitespace-nowrap">البيان والملاحظات</th>
                  <th className="p-4 whitespace-nowrap text-red-600 dark:text-red-400">مدين (+) / مسحوبات آجل</th>
                  <th className="p-4 whitespace-nowrap text-emerald-600 dark:text-emerald-400">دائن (-) / سداد نقدي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {statementEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">لا توجد مسحوبات آجلة أو سندات تحصيل مسجلة لهذا العميل حتى الآن</td>
                  </tr>
                ) : (
                  statementEvents.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${row.credit > 0 ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                        {row.date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-4 font-bold text-xs whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${row.credit > 0 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white text-xs">{row.ref}</td>
                      <td className="p-4 text-slate-800 dark:text-slate-200 text-xs font-medium">{row.notes}</td>
                      <td className="p-4 font-bold text-red-600 dark:text-red-400 font-mono">
                        {row.debit > 0 ? `+${formatPriceShort(row.debit)}` : '—'}
                      </td>
                      <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {row.credit > 0 ? `-${formatPriceShort(row.credit)}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Credit Settings Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">تعديل الحد الائتماني وإعدادات الأجل</h3>
              <button onClick={() => setShowCreditModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleUpdateCredit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم العميل / المتجر</label>
                <input type="text" disabled value={customer.store_name || customer.full_name} className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الحد الائتماني المعتمد (ج.م) *</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  step="any"
                  value={editCreditLimit}
                  onChange={(e) => setEditCreditLimit(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500" 
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox" 
                  id="credit_toggle"
                  checked={editCreditEnabled}
                  onChange={(e) => setEditCreditEnabled(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="credit_toggle" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  تفعيل إمكانية الشراء بالأجل لهذا العميل
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-xs shadow cursor-pointer">
                  {formLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button type="button" onClick={() => setShowCreditModal(false)} className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Recording Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                تسجيل سند تحصيل نقدي (سداد مديونية)
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">العميل</label>
                <input type="text" disabled value={customer.store_name || customer.full_name} className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">المبلغ المحصل نقداً (ج.م) *</label>
                <input 
                  type="number" 
                  name="amount"
                  required 
                  min="1"
                  step="any"
                  placeholder="أدخل المبلغ..."
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">البيان والملاحظات</label>
                <textarea 
                  name="notes"
                  rows={2}
                  placeholder="سداد نقدي من المندوب / تحويل بنكي / إيصال رقم..."
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={paymentLoading} className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-xs shadow cursor-pointer disabled:opacity-50">
                  {paymentLoading ? 'جاري التسجيل...' : 'تأكيد السند وتحديث الرصيد'}
                </button>
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}