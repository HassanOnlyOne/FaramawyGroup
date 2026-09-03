'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { ArrowRight, DollarSign, Printer, Loader2, Phone, FileText } from 'lucide-react';
import { useNumberFormat } from '@/context/number-format-context';
import { BRAND } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

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
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (prof) {
        setCustomer(prof);
        setEditCreditLimit(String(prof.credit_limit || 0));
        const enabled = prof.is_credit_enabled !== undefined ? Boolean(prof.is_credit_enabled) : (prof.credit_enabled !== false);
        setEditCreditEnabled(enabled);
      }

      const custCode = prof?.customer_code ? String(prof.customer_code).replace(/\D/g, '') : '';

      let orderQuery = supabase.from('orders').select('*');
      if (custCode) {
        orderQuery = orderQuery.or(`customer_id.eq.${id},customer_code.eq.${custCode},store_code.eq.${custCode}`);
      } else {
        orderQuery = orderQuery.eq('customer_id', id);
      }
      const { data: fetchedOrders } = await orderQuery.order('created_at', { ascending: false });
      setOrders(fetchedOrders || []);

      const { data: payList } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (payList && payList.length > 0) {
        setPayments(payList);
      } else {
        const { data: oldPays } = await supabase
          .from('payments')
          .select('*')
          .eq('customer_id', id)
          .order('created_at', { ascending: false });

        if (oldPays && oldPays.length > 0) {
          setPayments(oldPays);
        } else {
          const { data: allFallbackPays } = await supabase
            .from('customer_payments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          const matchedFallback = (allFallbackPays || []).filter((p: any) => {
            const pCode = String(p.customer_code || '').replace(/\D/g, '');
            return custCode && pCode === custCode;
          });
          setPayments(matchedFallback.length > 0 ? matchedFallback : (allFallbackPays || []));
        }
      }
    } catch (err) {
      console.error('Error fetching admin ledger:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateCredit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formLoading) return;
    setFormLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          credit_limit: Number(editCreditLimit || 0),
          is_credit_enabled: Boolean(editCreditEnabled),
          credit_enabled: Boolean(editCreditEnabled)
        })
        .eq('id', id);

      if (!error) {
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
    const notesVal = (formData.get('notes') as string) || 'سداد نقدي لحساب الأجل';
    const custCode = customer?.customer_code ? String(customer.customer_code).replace(/\D/g, '') : '1004';

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('customer_payments')
        .insert({
          customer_id: id,
          amount: amountVal,
          payment_method: 'cash',
          notes: notesVal
        });

      if (!error) {
        toast({ title: 'تم تسجيل تحصيل النقدية وتحديث المديونية بنجاح', type: 'success' });
        setShowPaymentModal(false);
        await fetchCustomerData();
      } else {
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

        const resData = await res.json().catch(() => ({}));

        if (res.ok || resData.success) {
          toast({ title: 'تم تسجيل تحصيل النقدية وتحديث المديونية بنجاح', type: 'success' });
          setShowPaymentModal(false);
          await fetchCustomerData();
        } else {
          toast({ title: resData.error || 'خطأ في تسجيل التحصيل', type: 'error' });
        }
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
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

  const creditWithdrawals = orders.filter((o: any) => {
    if (['pending', 'cancelled', 'returned'].includes(o.status)) return false;
    const isCredit = o.payment_method === 'credit';
    const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
    const paid = Number(o.paid_amount || 0);
    const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, tot - paid) : 0));
    return isCredit || rem > 0;
  });

  const statementEvents: any[] = [];

  creditWithdrawals.forEach((o: any) => {
    const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
    const paid = Number(o.paid_amount || 0);
    const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : Math.max(0, tot - paid));
    const debitAmount = rem > 0 ? rem : tot;

    const invNo = o.invoice_no || o.order_number || String(o.id).slice(0, 8);
    const cleanInv = String(invNo).replace(/\D/g, '') || invNo;

    statementEvents.push({
      date: new Date(o.created_at),
      type: 'فاتورة توريد (آجل)',
      ref: `فاتورة #${formatNumber(cleanInv)}`,
      notes: paid > 0 ? `إجمالي الفاتورة ${formatPriceShort(tot)} (مسدد كاش ${formatPriceShort(paid)})` : `فاتورة توريد بضاعة لحساب الأجل`,
      debit: debitAmount,
      credit: 0
    });
  });

  payments.forEach((p: any) => {
    const val = Number(p.amount || 0);
    const payId = String(p.id).replace(/\D/g, '').slice(0, 6) || '1';

    statementEvents.push({
      date: new Date(p.created_at || p.payment_date),
      type: 'سند تحصيل نقدي',
      ref: `سند تحصيل #${formatNumber(payId)}`,
      notes: p.notes || 'سداد نقدية لحساب الأجل',
      debit: 0,
      credit: val
    });
  });

  statementEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;
  statementEvents.forEach(ev => {
    runningBalance += (ev.debit - ev.credit);
  });

  const finalUnifiedDebt = statementEvents.length > 0 
    ? Math.max(0, runningBalance) 
    : Number(customer.current_debt !== undefined && customer.current_debt !== null ? customer.current_debt : (customer.previous_balance || 0));

  const creditLimit = Number(customer.credit_limit || 0);
  const availableCredit = Math.max(0, creditLimit - finalUnifiedDebt);

  const displayEvents = [...statementEvents].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* ترويسة خاصة بالطباعة الورقية فقط (Official Letterhead) */}
        <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4 text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-1">شركة الفرماوي جروب لتجارة وتوزيع المواد الغذائية</h1>
          <p className="text-sm font-bold text-slate-700">كشف حساب تفصيلي لحساب المسحوبات الآجلة والتحصيلات</p>
          <div className="flex justify-between items-center text-xs mt-4 pt-2 border-t border-slate-200">
            <div>
              <span className="font-bold">اسم العميل: </span>
              <span>{customer.store_name || customer.full_name}</span>
            </div>
            <div>
              <span className="font-bold">كود العميل: </span>
              <span className="font-mono">#{custCodeClean}</span>
            </div>
            <div>
              <span className="font-bold">تاريخ الطباعة: </span>
              <span>{new Date().toLocaleDateString('ar-EG')}</span>
            </div>
          </div>
        </div>

        {/* شريط الإجراءات والترويسة على الشاشة */}
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

        {/* بطاقات المؤشرات المالية */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4 print:mb-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:p-3 print:border-slate-300">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1 print:text-black">إجمالي المديونية المتبقية المستحقة</span>
            <span className="text-3xl font-black text-red-600 dark:text-red-400 font-mono print:text-xl print:text-black">{formatPriceShort(finalUnifiedDebt)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:p-3 print:border-slate-300">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 print:text-black">الحد الائتماني المعتمد</span>
              <button onClick={() => setShowCreditModal(true)} className="text-[11px] text-brand-600 dark:text-emerald-400 hover:underline font-bold print:hidden">تعديل</button>
            </div>
            <span className="text-3xl font-black text-slate-900 dark:text-white font-mono print:text-xl print:text-black">{formatPriceShort(creditLimit)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:p-3 print:border-slate-300">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1 print:text-black">الرصيد الائتماني المتاح للشراء</span>
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono print:text-xl print:text-black">{formatPriceShort(availableCredit)}</span>
          </div>
        </div>

        {/* جدول كشف الحساب الموحد */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none print:rounded-none">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center print:hidden">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>كشف حساب تفصيلي للمسحوبات الآجلة والتحصيلات</span>
            </h2>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">عدد الحركات: {formatNumber(displayEvents.length)}</span>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-right text-sm print:text-xs print:w-full border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700 print:bg-slate-100 print:text-black">
                <tr>
                  <th className="p-4 whitespace-nowrap print:p-2 print:border print:border-slate-300">التاريخ</th>
                  <th className="p-4 whitespace-nowrap print:p-2 print:border print:border-slate-300">نوع الحركة</th>
                  <th className="p-4 whitespace-nowrap print:p-2 print:border print:border-slate-300">رقم المرجع</th>
                  <th className="p-4 whitespace-nowrap print:p-2 print:border print:border-slate-300">البيان والملاحظات</th>
                  <th className="p-4 whitespace-nowrap text-red-600 dark:text-red-400 print:text-black print:p-2 print:border print:border-slate-300">مدين (+) / مسحوبات آجل</th>
                  <th className="p-4 whitespace-nowrap text-emerald-600 dark:text-emerald-400 print:text-black print:p-2 print:border print:border-slate-300">دائن (-) / سداد نقدي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-300">
                {displayEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium print:p-4 print:border">لا توجد مسحوبات آجلة أو سندات تحصيل مسجلة لهذا العميل حتى الآن</td>
                  </tr>
                ) : (
                  displayEvents.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${row.credit > 0 ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''} print:bg-transparent`}>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap print:p-2 print:text-black print:border print:border-slate-300">
                        {row.date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-4 font-bold text-xs whitespace-nowrap print:p-2 print:text-black print:border print:border-slate-300">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block print:p-0 print:border-none ${row.credit > 0 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white text-xs print:p-2 print:text-black print:border print:border-slate-300">{row.ref}</td>
                      <td className="p-4 text-slate-800 dark:text-slate-200 text-xs font-medium print:p-2 print:text-black print:border print:border-slate-300">{row.notes}</td>
                      <td className="p-4 font-bold text-red-600 dark:text-red-400 font-mono print:p-2 print:text-black print:border print:border-slate-300">
                        {row.debit > 0 ? `+${formatPriceShort(row.debit)}` : '—'}
                      </td>
                      <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono print:p-2 print:text-black print:border print:border-slate-300">
                        {row.credit > 0 ? `-${formatPriceShort(row.credit)}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* تذييل الطباعة الرسمي */}
        <div className="hidden print:flex justify-between items-center mt-12 pt-6 border-t border-slate-300 text-xs font-bold">
          <div>توقيع المحاسب / المسؤول: ...........................</div>
          <div>توقيع واستلام العميل: ...........................</div>
        </div>
      </div>

      {/* نافذة تعديل الحد الائتماني */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">تعديل الحد الائتماني وإعدادات الأجل</h3>
              <button 
                type="button"
                disabled={formLoading}
                onClick={() => setShowCreditModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold disabled:opacity-50"
              >
                &times;
              </button>
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
                  disabled={formLoading}
                  value={editCreditLimit}
                  onChange={(e) => setEditCreditLimit(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50" 
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox" 
                  id="credit_toggle"
                  disabled={formLoading}
                  checked={editCreditEnabled}
                  onChange={(e) => setEditCreditEnabled(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="credit_toggle" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  تفعيل إمكانية الشراء بالأجل لهذا العميل
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-xs shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {formLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    'حفظ التعديلات'
                  )}
                </button>
                <button type="button" disabled={formLoading} onClick={() => setShowCreditModal(false)} className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تسجيل سند تحصيل نقدي */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                تسجيل سند تحصيل نقدي (سداد مديونية)
              </h3>
              <button 
                type="button"
                disabled={paymentLoading}
                onClick={() => setShowPaymentModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold disabled:opacity-50"
              >
                &times;
              </button>
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
                  disabled={paymentLoading}
                  placeholder="أدخل المبلغ..."
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">البيان والملاحظات</label>
                <textarea 
                  name="notes"
                  rows={2}
                  disabled={paymentLoading}
                  placeholder="سداد نقدي من المندوب / تحويل بنكي / إيصال رقم..."
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                ></textarea>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={paymentLoading} className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-xs shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التسجيل...</span>
                    </>
                  ) : (
                    'تأكيد السند وتحديث الرصيد'
                  )}
                </button>
                <button type="button" disabled={paymentLoading} onClick={() => setShowPaymentModal(false)} className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* تنسيق الطباعة الصارم لإلغاء أشرطة التمرير والروابط وتنسيق الورقة */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 10mm 10mm 15mm 10mm;
            size: A4 portrait;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, nav, aside, .print\\:hidden {
            display: none !important;
          }
          .overflow-x-auto {
            overflow: visible !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>
    </AdminLayout>
  );
}