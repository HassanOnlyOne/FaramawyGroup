'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useNumberFormat } from '@/context/number-format-context';
import { Banknote, CreditCard, TrendingUp, ArrowDownLeft, ArrowUpRight, Loader2, Plus, Truck, FileText } from 'lucide-react';

export default function TreasuryPage() {
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTreasuryData();
  }, []);

  async function fetchTreasuryData() {
    try {
      const [payRes, expRes, purRes, ordRes] = await Promise.all([
        fetch(`/api/payments?t=${Date.now()}`),
        fetch(`/api/expenses?t=${Date.now()}`),
        fetch(`/api/admin/purchases?t=${Date.now()}`),
        fetch(`/api/orders?status=completed&limit=100&t=${Date.now()}`)
      ]);

      if (payRes.ok) {
        const payData = await payRes.json();
        setPayments(Array.isArray(payData) ? payData : (payData?.data || payData?.payments || []));
      }

      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(Array.isArray(expData) ? expData : (expData?.data || expData?.expenses || []));
      }

      if (purRes.ok) {
        const purData = await purRes.json();
        setPurchases(Array.isArray(purData) ? purData : (purData?.data || purData?.purchases || []));
      }

      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(Array.isArray(ordData) ? ordData : (ordData?.data || ordData?.orders || []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 1. INFLOWS:
  const directPaymentsCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const orderCashCollected = orders.reduce((sum, o) => {
    const paid = Number(o.paid_amount || 0);
    const total = Number(o.total !== undefined ? o.total : (o.total_amount || 0));
    return sum + (paid > 0 ? paid : (o.payment_method === 'cash' ? total : 0));
  }, 0);
  const totalInflows = directPaymentsCollected + orderCashCollected;

  // 2. OUTFLOWS:
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const purchaseCashPaid = purchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const totalOutflows = totalExpenses + purchaseCashPaid;

  // 3. NET LIQUIDITY:
  const netSafeBalance = totalInflows - totalOutflows;

  // Multi-source timeline
  const transactions: any[] = [];

  payments.forEach(p => {
    transactions.push({
      id: `pay-${p.id}`,
      date: p.payment_date || p.created_at,
      type: 'سند تحصيل عميل',
      party: p.customer?.store_name || p.customer?.full_name || 'عميل تجزئة',
      inflow: Number(p.amount || 0),
      outflow: 0,
      notes: p.notes || 'سداد دفعة تحت الحساب'
    });
  });

  orders.forEach(o => {
    const paid = Number(o.paid_amount || 0);
    const total = Number(o.total !== undefined ? o.total : (o.total_amount || 0));
    const cashVal = paid > 0 ? paid : (o.payment_method === 'cash' ? total : 0);
    if (cashVal > 0) {
      transactions.push({
        id: `ord-${o.id}`,
        date: o.created_at,
        type: 'مبيعات كاش مستلمة',
        party: o.store_name_ref || o.customer?.store_name || o.customer?.full_name || 'عميل تجاري',
        inflow: cashVal,
        outflow: 0,
        notes: `فاتورة مبيعات #${o.invoice_no || o.order_number || String(o.id).slice(0, 6)}`
      });
    }
  });

  expenses.forEach(e => {
    transactions.push({
      id: `exp-${e.id}`,
      date: e.expense_date || e.created_at,
      type: 'مصروف تشغيلي',
      party: e.category || 'مصروفات متنوعة',
      inflow: 0,
      outflow: Number(e.amount || 0),
      notes: e.description || e.notes || 'مصروف عام'
    });
  });

  purchases.forEach(p => {
    const paid = Number(p.paid_amount || 0);
    if (paid > 0) {
      transactions.push({
        id: `pur-${p.id}`,
        date: p.created_at,
        type: 'سداد مشتريات مورد',
        party: p.supplier?.company_name || p.supplier?.name || p.supplier_name || 'مورد بضائع',
        inflow: 0,
        outflow: paid,
        notes: `فاتورة مشتريات #${p.invoice_no || p.invoice_number || String(p.id).slice(0, 6)}`
      });
    }
  });

  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">إدارة الخزينة والسيولة النقدية</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تتبع المقبوضات والمدفوعات النقدية وصافي السيولة الفعلية المتاحة</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/payments" className="btn-primary flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow">
              <Plus className="w-4 h-4" />
              <span>تسجيل تحصيل نقدي</span>
            </Link>
            <Link href="/admin/expenses" className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl">
              <CreditCard className="w-4 h-4" />
              <span>تسجيل مصروف</span>
            </Link>
          </div>
        </div>

        {/* Treasury Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المقبوضات (الوارد للخزينة)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatPriceShort(totalInflows)}</span>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 flex justify-between">
              <span>مبيعات: {formatPriceShort(orderCashCollected)}</span>
              <span>تحصيلات: {formatPriceShort(directPaymentsCollected)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المدفوعات (المنصرف من الخزينة)</span>
              <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{formatPriceShort(totalOutflows)}</span>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 flex justify-between">
              <span>مشتريات كاش: {formatPriceShort(purchaseCashPaid)}</span>
              <span>مصروفات: {formatPriceShort(totalExpenses)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">صافي رصيد الخزينة الحالي (السيولة)</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <span className={`text-2xl font-black font-mono ${netSafeBalance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
              {formatPriceShort(netSafeBalance)}
            </span>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">الرصيد النقدي الحر المتاح بالخزينة</p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-base">سجل الحركة النقدية التفصيلي للخزينة</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{formatNumber(transactions.length)} حركة مسجلة</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">التاريخ والوقت</th>
                  <th className="p-4 whitespace-nowrap">نوع الحركة</th>
                  <th className="p-4 whitespace-nowrap">الجهة / الطرف</th>
                  <th className="p-4 whitespace-nowrap">الوارد (+)</th>
                  <th className="p-4 whitespace-nowrap">المنصرف (-)</th>
                  <th className="p-4 whitespace-nowrap">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">لا توجد حركات نقدية مسجلة بالخزينة حتى الآن</td></tr>
                ) : (
                  transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {new Date(t.date).toLocaleDateString('ar-EG')} - {new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${t.inflow > 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{t.party}</td>
                      <td className="p-4 font-bold text-emerald-700 dark:text-emerald-400 font-mono text-base">
                        {t.inflow > 0 ? `+${formatPriceShort(t.inflow)}` : '---'}
                      </td>
                      <td className="p-4 font-bold text-red-600 dark:text-red-400 font-mono text-base">
                        {t.outflow > 0 ? `-${formatPriceShort(t.outflow)}` : '---'}
                      </td>
                      <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{t.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
