'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { Users, Plus, Search, ShieldCheck, Phone, MapPin, Edit, Eye, EyeOff, Key, Loader2, CheckCircle2 } from 'lucide-react';

export default function CustomersPage() {
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Password reset state
  const [newCustomerPassword, setNewCustomerPassword] = useState('');
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const handleResetCustomerPassword = async () => {
    if (!editCustomer || !newCustomerPassword || newCustomerPassword.length < 6) {
      toast({ title: 'تنبيه', description: 'كلمة المرور يجب أن تكون 6 خانات على الأقل', type: 'error' });
      return;
    }

    setResetPasswordLoading(true);
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editCustomer.id,
          newPassword: newCustomerPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast({
          title: 'تم تحديث كلمة المرور بنجاح',
          description: data.message || `تم تغيير كلمة المرور للمستخدم (${editCustomer.store_name || editCustomer.full_name})`,
          type: 'success'
        });
        setNewCustomerPassword('');
      } else {
        toast({
          title: 'خطأ في تحديث كلمة المرور',
          description: data.error || 'فشل إعادة تعيين كلمة المرور',
          type: 'error'
        });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const [custRes, ordRes, payRes] = await Promise.all([
        fetch(`/api/customers?t=${Date.now()}`),
        fetch(`/api/orders?limit=200&t=${Date.now()}`),
        fetch(`/api/payments?t=${Date.now()}`)
      ]);

      let ordList: any[] = [];
      if (ordRes.ok) {
        const ordJson = await ordRes.json();
        ordList = Array.isArray(ordJson) ? ordJson : (ordJson.data || ordJson.orders || []);
      }

      let payList: any[] = [];
      if (payRes.ok) {
        const payJson = await payRes.json();
        payList = Array.isArray(payJson) ? payJson : (payJson.data || payJson.payments || []);
      }

      if (custRes.ok) {
        const json = await custRes.json();
        const rawCusts = json.data || json.customers || [];
        
        // Calculate dynamic live debt per customer (Gross Invoices - Total Payments)
        const enriched = rawCusts.map((c: any) => {
          const custCode = String(c.customer_code || '').replace(/\D/g, '');
          const customerOrders = ordList.filter((o: any) => 
            (o.customer_id && o.customer_id === c.id) ||
            (o.customer?.id && o.customer?.id === c.id) ||
            (custCode === '1004' && (o.customer_code === '1004' || o.customer_code === '1000' || o.store_name_ref?.includes('عمر'))) ||
            (custCode === '1000' && (o.customer_code === '1000' || !o.customer_id || o.store_name_ref?.includes('عمر')))
          );

          const customerPayments = payList.filter((p: any) =>
            (p.customer_id && p.customer_id === c.id) ||
            (p.customer?.id && p.customer?.id === c.id) ||
            (custCode && (String(p.customer_code || '').includes(custCode) || String(p.customer?.customer_code || '').includes(custCode))) ||
            (custCode === '1004' && (String(p.customer_code || '').includes('1004') || String(p.customer_code || '').includes('1000')))
          );

          const totalPaidReceipts = customerPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

          const liveOrderDebt = customerOrders
            .filter((o: any) => !['cancelled', 'returned'].includes(o.status))
            .reduce((sum: number, o: any) => {
              const rem = Number(o.remaining_amount !== undefined ? o.remaining_amount : (o.payment_method === 'credit' ? (o.total || o.total_amount || 0) : 0));
              return sum + rem;
            }, 0);

          const directProfileDebt = Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0));
          const finalDebt = liveOrderDebt > 0 
            ? Math.max(0, liveOrderDebt - totalPaidReceipts) 
            : directProfileDebt;

          return {
            ...c,
            current_debt: finalDebt,
            previous_balance: finalDebt
          };
        });

        setCustomers(enriched);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer) return;

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${editCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credit_limit: parseFloat(editCustomer.credit_limit) || 0,
          is_credit_enabled: Boolean(editCustomer.is_credit_enabled !== undefined ? editCustomer.is_credit_enabled : editCustomer.credit_enabled),
          credit_enabled: Boolean(editCustomer.is_credit_enabled !== undefined ? editCustomer.is_credit_enabled : editCustomer.credit_enabled),
          store_name: editCustomer.store_name,
          phone: editCustomer.phone,
          address: editCustomer.address,
        })
      });

      if (res.ok) {
        toast({ title: 'تم تحديث بيانات العميل والحد الائتماني بنجاح', type: 'success' });
        setEditCustomer(null);
        await fetchCustomers();
      } else {
        toast({ title: 'خطأ في تعديل العميل', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const filtered = safeCustomers.filter(c => {
    const codeStr = String(c.customer_code || '').replace(/\D/g, '');
    return (
      (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.store_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      codeStr.includes(search)
    );
  });

  const totalReceivables = safeCustomers.reduce((sum, c) => sum + Number(c.current_debt || c.previous_balance || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">إدارة العملاء والتجار والأجل</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تتبع مديونيات التجار، الحدود الائتمانية المعتمدة، وسجل الطلبات</p>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="بحث بالاسم، كود العميل، أو الهاتف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-9 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        </div>

        {/* Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي المديونيات المستحقة على العملاء</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{formatPriceShort(totalReceivables)}</span>
            </div>
            <div className="w-12 h-12 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي عدد العملاء المسجلين</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{formatNumber(safeCustomers.length)} عميل</span>
            </div>
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">كود العميل</th>
                  <th className="p-4 whitespace-nowrap">اسم العميل / المتجر</th>
                  <th className="p-4 whitespace-nowrap">الهاتف والعنوان</th>
                  <th className="p-4 whitespace-nowrap">المديونية الحالية</th>
                  <th className="p-4 whitespace-nowrap">الحد الائتماني</th>
                  <th className="p-4 whitespace-nowrap text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">لا يوجد عملاء مطابقين للبحث</td></tr>
                ) : (
                  filtered.map(c => {
                    const cleanCode = String(c.customer_code || '1000').replace(/\D/g, '') || '1000';
                    const debtVal = Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0));
                    const limitVal = Number(c.credit_limit || 50000);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          #{formatNumber(cleanCode)}
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{c.store_name || c.full_name || 'عميل تجزئة'}</span>
                          {c.store_name && c.full_name && <span className="text-[11px] text-slate-400 block">{c.full_name}</span>}
                        </td>
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-300">
                          <div className="font-mono font-bold" dir="ltr">{formatNumber(c.phone || '01066918217')}</div>
                          <div className="text-slate-400 truncate max-w-[180px]">{c.address || 'المخزن الرئيسي'}</div>
                        </td>
                        <td className="p-4 font-bold text-red-600 dark:text-red-400 font-mono text-base">{formatPriceShort(debtVal)}</td>
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100 font-mono">{formatPriceShort(limitVal)}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            {(c.is_credit_enabled === true || (c.is_credit_enabled === undefined && c.credit_enabled !== false)) ? (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 whitespace-nowrap">
                                ✓ الآجل مفعّل
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 whitespace-nowrap">
                                ✕ الآجل معطّل
                              </span>
                            )}
                            <button
                              onClick={() => setEditCustomer({ ...c })}
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              title="تعديل الحد الائتماني والبيانات"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>تعديل الائتمان</span>
                            </button>
                            <Link
                              href={`/admin/customers/${c.id}`}
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                              title="كشف الحساب والطلبات"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      {editCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-blue-50 dark:bg-blue-950/60">
              <h3 className="font-bold text-base text-blue-900 dark:text-blue-300">تعديل بيانات العميل والائتمان</h3>
              <button onClick={() => setEditCustomer(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleUpdateCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم المتجر / المحل</label>
                <input
                  type="text"
                  required
                  value={editCustomer.store_name || ''}
                  onChange={e => setEditCustomer({ ...editCustomer, store_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الحد الائتماني الأقصى المسموح (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={editCustomer.credit_limit ?? 50000}
                  onChange={e => setEditCustomer({ ...editCustomer, credit_limit: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input 
                  type="checkbox" 
                  id="cust_credit_enabled"
                  checked={Boolean(editCustomer.is_credit_enabled !== undefined ? editCustomer.is_credit_enabled : editCustomer.credit_enabled)}
                  onChange={e => setEditCustomer({ ...editCustomer, is_credit_enabled: e.target.checked, credit_enabled: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="cust_credit_enabled" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  تفعيل إمكانية الشراء بالأجل لهذا التاجر
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={editCustomer.phone || ''}
                  onChange={e => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">عنوان المتجر / مقر التسليم</label>
                <textarea
                  rows={2}
                  value={editCustomer.address || ''}
                  onChange={e => setEditCustomer({ ...editCustomer, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs"
                ></textarea>
              </div>

              {/* Reset Password Section */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  إعادة تعيين كلمة المرور للعميل
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showCustomerPassword ? 'text' : 'password'}
                      placeholder="كلمة المرور الجديدة (6 خانات+)"
                      value={newCustomerPassword}
                      onChange={e => setNewCustomerPassword(e.target.value)}
                      className="w-full pr-3 pl-9 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomerPassword(!showCustomerPassword)}
                      className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                      title={showCustomerPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showCustomerPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={resetPasswordLoading || !newCustomerPassword || newCustomerPassword.length < 6}
                    onClick={handleResetCustomerPassword}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {resetPasswordLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Key className="w-3.5 h-3.5" />
                    )}
                    <span>تحديث كلمة المرور</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  يمكن للمشرف تعيين كلمة مرور جديدة للتاجر وتزويده بها مباشرة
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold shadow text-xs cursor-pointer"
                >
                  {formLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditCustomer(null);
                    setNewCustomerPassword('');
                  }}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
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
