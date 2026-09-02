'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { ORDER_STATUS_LABELS, BRAND } from '@/lib/constants';
import { useNumberFormat } from '@/context/number-format-context';
import { createClient } from '@/lib/supabase/client';
import { CreditCard, ShieldCheck, Clock, FileText, CheckCircle2, Lock, PhoneCall, ShoppingBag, RefreshCw } from 'lucide-react';

export default function CreditPage() {
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCreditStatement() {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // 1. Fetch authenticated user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      
      let currentProfile: any = null;
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (p) currentProfile = p;

      // 2. Fetch live data from /api/credit with no cache
      const apiRes = await fetch(`/api/credit?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (apiRes.ok) {
        const apiJson = await apiRes.json();
        if (apiJson.success) {
          if (!currentProfile) {
            currentProfile = apiJson.profile;
          } else if (apiJson.profile) {
            currentProfile = {
              ...currentProfile,
              ...apiJson.profile,
              is_credit_enabled: apiJson.profile.is_credit_enabled !== undefined ? apiJson.profile.is_credit_enabled : currentProfile.is_credit_enabled,
              credit_limit: apiJson.profile.credit_limit !== undefined ? apiJson.profile.credit_limit : currentProfile.credit_limit,
              current_debt: apiJson.profile.current_debt !== undefined ? apiJson.profile.current_debt : currentProfile.current_debt,
            };
          }
          if (Array.isArray(apiJson.credit_orders)) {
            setOrders(apiJson.credit_orders);
          }
          if (Array.isArray(apiJson.payments)) {
            setPayments(apiJson.payments);
          }
        }
      }

      const customerCode = currentProfile?.customer_code ? String(currentProfile.customer_code).replace(/\D/g, '') : (currentProfile?.id ? String(currentProfile.id).slice(-4) : '1004');
      setProfile(currentProfile || { customer_code: customerCode, credit_limit: 0, full_name: 'تاجر تجزئة', is_credit_enabled: false });

      // 3. Direct customer_payments fetch if payments empty
      if (payments.length === 0) {
        let custPayQuery = supabase
          .from('customer_payments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (user?.id) {
          custPayQuery = custPayQuery.eq('customer_id', user.id);
        }

        const { data: payList } = await custPayQuery;
        if (payList && payList.length > 0) {
          setPayments(payList);
        } else {
          const { data: oldPays } = await supabase
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          if (oldPays) setPayments(oldPays);
        }
      }

      // 4. Direct orders fetch if orders empty
      if (orders.length === 0) {
        let query = supabase.from('orders').select('*');
        if (user?.id) {
          query = query.or(`customer_code.eq.${customerCode},customer_id.eq.${user.id},store_code.eq.${customerCode}`);
        } else {
          query = query.or(`customer_code.eq.${customerCode},store_code.eq.${customerCode}`);
        }

        const { data: fetchedOrders } = await query.order('created_at', { ascending: false });
        if (fetchedOrders && fetchedOrders.length > 0) {
          setOrders(fetchedOrders);
        }
      }

    } catch (err) {
      console.error('Error loading credit page:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCreditStatement();
  }, []);

  // Strict check for credit enablement
  const isCreditEnabled = profile 
    ? Boolean(
        profile.is_credit_enabled === true || 
        (profile.is_credit_enabled === undefined && profile.credit_enabled === true && Number(profile.credit_limit || 0) > 0)
      )
    : false;

  const creditLimit = Number(profile?.credit_limit || 0);

  // Credit orders list (Strictly excluding pending, cancelled, returned, and pure cash orders)
  const safeOrders = Array.isArray(orders) ? orders : [];
  const creditWithdrawals = safeOrders.filter((o: any) => {
    if (['pending', 'cancelled', 'returned'].includes(o.status)) return false;
    const isCredit = o.payment_method === 'credit';
    const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
    const paid = Number(o.paid_amount || 0);
    const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, tot - paid) : 0));
    return isCredit || rem > 0;
  });

  // Calculate Unified Statement Ledger & Running Balance
  const statementEvents: any[] = [];

  creditWithdrawals.forEach((o: any) => {
    const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
    const paid = Number(o.paid_amount || 0);
    const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : Math.max(0, tot - paid));
    const debitAmount = rem > 0 ? rem : tot;

    statementEvents.push({
      date: new Date(o.created_at),
      debit: debitAmount,
      credit: 0
    });
  });

  payments.forEach((p: any) => {
    statementEvents.push({
      date: new Date(p.created_at || p.payment_date),
      debit: 0,
      credit: Number(p.amount || 0)
    });
  });

  statementEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;
  statementEvents.forEach(ev => {
    runningBalance += (ev.debit - ev.credit);
  });

  const latestLedgerBalance = Math.max(0, runningBalance);

  // Top Card Debt: Strictly unified with the cumulative statement ledger!
  const finalUnifiedDebt = statementEvents.length > 0 
    ? latestLedgerBalance 
    : Number(profile?.current_debt !== undefined && profile?.current_debt !== null ? profile.current_debt : (profile?.previous_balance || 0));

  const availableCredit = Math.max(0, creditLimit - finalUnifiedDebt);

  const contactPhone = BRAND.contacts[0] || '01066918217';

  return (
    <CustomerLayout>
      <div className="space-y-5 sm:space-y-6 pb-28 max-w-5xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4" dir="rtl">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">كشف حساب الدفع الأجل</h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">متابعة المديونية، الحد الائتماني، وسجل المسحوبات والتحصيلات</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={loadCreditStatement}
              disabled={loading}
              title="تحديث البيانات"
              className="p-2 sm:p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-[11px] sm:text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 sm:py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm whitespace-nowrap">
              كود العميل: #{formatNumber(profile?.customer_code ? String(profile.customer_code).replace(/\D/g, '') : (profile?.id ? String(profile.id).slice(-4) : '1004'))}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-48 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-3xl"></div>
        ) : !isCreditEnabled ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center max-w-2xl mx-auto my-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-4 sm:mb-5 shadow-sm">
              <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
              خاصية الشراء والدفع الآجل غير مفعلة لحسابك
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              عفواً، حسابك غير مدرج ضمن قائمة البيع الآجل حالياً. يمكنك الشراء نقداً (كاش) عند الاستلام، أو التواصل مع إدارة الفرماوي جروب لمراجعة وتفعيل التسهيلات الائتمانية لمتجرك.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <a
                href={`https://wa.me/2${contactPhone}?text=${encodeURIComponent(`السلام عليكم، أرغب في تفعيل خاصية الدفع الآجل لمتجري (كود: ${profile?.customer_code || profile?.id || ''})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-md"
              >
                <PhoneCall className="w-4 h-4" />
                <span>تواصل مع الإدارة (واتساب / هاتف)</span>
              </a>

              <Link
                href="/"
                className="w-full sm:w-auto btn-secondary flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>تصفح المنتجات والشراء كاش</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Credit Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-red-50/70 dark:bg-red-950/40 p-4 sm:p-5 rounded-3xl border border-red-200 dark:border-red-900/50 text-center shadow-sm">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/60 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-300 mx-auto mb-2">
                  <CreditCard className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">الرصيد الحالي (مديونية مستحقة)</p>
                <p className="text-2xl font-black text-red-800 dark:text-red-300 font-mono">{formatPriceShort(finalUnifiedDebt)}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-700 dark:text-slate-300 mx-auto mb-2">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الحد الائتماني المعتمد</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{formatPriceShort(creditLimit)}</p>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-4 sm:p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 text-center shadow-sm">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/60 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-300 mx-auto mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">الرصيد الائتماني المتاح</p>
                <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 font-mono">{formatPriceShort(availableCredit)}</p>
              </div>
            </div>

            {/* Credit Withdrawals */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">أحدث المسحوبات (آجل)</h2>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">{creditWithdrawals.length} عمليات</span>
              </div>

              {creditWithdrawals.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium text-xs">لا توجد مسحوبات آجلة مسجلة حتى الآن</div>
              ) : (
                <>
                  {/* Mobile Card List */}
                  <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {creditWithdrawals.map(o => {
                      const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
                      const pd = Number(o.paid_amount || 0);
                      const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : Math.max(0, tot - pd));
                      const invNo = o.invoice_no || o.order_number || String(o.id).slice(0, 8);
                      const cleanInv = String(invNo).replace(/\D/g, '') || invNo;

                      return (
                        <div key={o.id} className="p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-brand-700 dark:text-emerald-400 text-xs">
                              فاتورة #{formatNumber(cleanInv)}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] || o.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                            <div>
                              <span className="text-[10px] text-slate-400 block">الإجمالي</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{formatPriceShort(tot)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">المدفوع كاش</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPriceShort(pd)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">المتبقي آجل</span>
                              <span className="font-black text-red-600 dark:text-red-400">{formatPriceShort(rem)}</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                            <span>التاريخ:</span>
                            <span>{new Date(o.created_at).toLocaleDateString('ar-EG')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3.5">رقم الفاتورة</th>
                          <th className="p-3.5">التاريخ</th>
                          <th className="p-3.5">قيمة الفاتورة</th>
                          <th className="p-3.5">المدفوع كاش</th>
                          <th className="p-3.5">المتبقي (آجل)</th>
                          <th className="p-3.5">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {creditWithdrawals.map(o => {
                          const tot = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
                          const pd = Number(o.paid_amount || 0);
                          const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : Math.max(0, tot - pd));
                          const invNo = o.invoice_no || o.order_number || String(o.id).slice(0, 8);
                          const cleanInv = String(invNo).replace(/\D/g, '') || invNo;

                          return (
                            <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-3.5 font-mono font-bold text-brand-600 dark:text-brand-400">
                                #{formatNumber(cleanInv)}
                              </td>
                              <td className="p-3.5 text-slate-600 dark:text-slate-400">
                                {new Date(o.created_at).toLocaleDateString('ar-EG')}
                              </td>
                              <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {formatPriceShort(tot)}
                              </td>
                              <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {formatPriceShort(pd)}
                              </td>
                              <td className="p-3.5 font-mono font-black text-red-600 dark:text-red-400">
                                {formatPriceShort(rem)}
                              </td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] || o.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Direct Cash Payments & Receipts from customer_payments */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/40 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-300">سندات التحصيل والسداد النقدي</h2>
                </div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">{payments.length} سندات</span>
              </div>

              {payments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium text-xs">لا توجد سندات سداد نقدي مسجلة حتى الآن</div>
              ) : (
                <>
                  {/* Mobile Card List */}
                  <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {payments.map(p => (
                      <div key={p.id} className="p-4 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                            سند #{formatNumber(String(p.id).replace(/\D/g, '').slice(0, 6) || '1')}
                          </span>
                          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                            {formatPriceShort(p.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          {p.notes || 'سداد دفعة نقدية لحساب الأجل'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(p.created_at || p.payment_date).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3.5">رقم السند</th>
                          <th className="p-3.5">التاريخ</th>
                          <th className="p-3.5">المبلغ المسدد</th>
                          <th className="p-3.5">البيان / ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {payments.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              سند #{formatNumber(String(p.id).replace(/\D/g, '').slice(0, 6) || '1')}
                            </td>
                            <td className="p-3.5 text-slate-600 dark:text-slate-400">
                              {new Date(p.created_at || p.payment_date).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="p-3.5 font-mono font-black text-emerald-700 dark:text-emerald-400">
                              {formatPriceShort(p.amount)}
                            </td>
                            <td className="p-3.5 text-slate-700 dark:text-slate-300">
                              {p.notes || 'سداد دفعة نقدية لحساب الأجل'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
