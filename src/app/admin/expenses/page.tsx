'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layout/admin-layout';
import { formatPriceShort } from '@/lib/constants';
import { useToast } from '@/components/ui/toast';
import { CreditCard, Plus, Search, Loader2, Edit, Trash2, Banknote, Calendar, Tag, FileText } from 'lucide-react';

export default function ExpensesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [newExpense, setNewExpense] = useState({
    title: '',
    category: 'نقل ونولون',
    amount: '',
    notes: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    try {
      const res = await fetch(`/api/expenses?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setExpenses(json.data || json.expenses || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.title.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال بيان المصروف', type: 'error' });
      return;
    }

    const numAmount = Number(newExpense.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال مبلغ صحيح أكبر من الصفر', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        title: newExpense.title.trim(),
        category: newExpense.category || 'تشغيلي',
        amount: numAmount,
        notes: newExpense.notes?.trim() || null
      };

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.error) {
        toast({ title: 'تم تسجيل المصروف بنجاح', description: `تم قيد مبلغ ${formatPriceShort(numAmount)} في المصروفات التشغيلية والخزينة`, type: 'success' });
        setShowModal(false);
        setNewExpense({ title: '', category: 'نقل ونولون', amount: '', notes: '' });
        await fetchExpenses();
        router.refresh();
      } else {
        toast({ title: 'خطأ في حفظ المصروف', description: data.error || 'تعذر تسجيل المصروف', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;

    const numAmount = Number(editExpense.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال مبلغ صحيح أكبر من الصفر', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        id: editExpense.id,
        title: editExpense.title?.trim() || 'مصروف',
        category: editExpense.category || 'تشغيلي',
        amount: numAmount,
        notes: editExpense.notes?.trim() || null
      };

      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.error) {
        toast({ title: 'تم تحديث بيانات المصروف بنجاح', type: 'success' });
        setEditExpense(null);
        await fetchExpenses();
        router.refresh();
      } else {
        toast({ title: 'خطأ في تعديل المصروف', description: data.error || 'فشل تحديث المصروف', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteExpense = async (exp: any) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف بند المصروف "${exp.title}"؟`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/expenses?id=${exp.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast({ title: 'تم حذف المصروف بنجاح', type: 'success' });
        await fetchExpenses();
        router.refresh();
      } else {
        toast({ title: 'خطأ في حذف المصروف', type: 'error' });
      }
    } catch (err) {
      toast({ title: 'خطأ في الاتصال', type: 'error' });
    }
  };

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const filtered = safeExpenses.filter(e =>
    (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.notes || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenseSum = safeExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">جدول المصروفات التشغيلية والخزينة</h1>
            <p className="text-slate-500 text-sm mt-1">تتبع مصروفات النقل، الرواتب، صيانة السيارة، وإيجار المخزن</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>إضافة بند مصروفات</span>
            </button>
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="بحث ببيان المصروف أو الفئة..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-9 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>
        </div>

        {/* Expenses Summary Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي المصروفات التشغيلية المسجلة</span>
            <span className="text-2xl font-black text-red-600 font-mono">{formatPriceShort(totalExpenseSum)}</span>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200 font-mono">
            عدد البنود: {safeExpenses.length}
          </span>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">بيان المصروف</th>
                  <th className="p-4">الفئة</th>
                  <th className="p-4">المبلغ</th>
                  <th className="p-4">ملاحظات</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                      <span>جاري تحميل المصروفات...</span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      لا توجد مصروفات مسجلة مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filtered.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-xs font-mono text-slate-600">
                        {new Date(exp.created_at || Date.now()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-4 font-bold text-slate-900">{exp.title}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {exp.category || 'تشغيلي'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-black text-red-600 text-base">
                        {formatPriceShort(Number(exp.amount || 0))}
                      </td>
                      <td className="p-4 text-xs text-slate-600">{exp.notes || '---'}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditExpense(exp)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Expense Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-300 animate-scale-in" dir="rtl">
              <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3">إضافة بند مصروفات جديد</h2>
              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">بيان المصروف *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: بنزين ونولون سيارة التوزيع"
                    value={newExpense.title}
                    onChange={e => setNewExpense({ ...newExpense, title: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الفئة *</label>
                    <select
                      value={newExpense.category}
                      onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 bg-white"
                    >
                      <option value="نقل ونولون">نقل ونولون</option>
                      <option value="رواتب ويوميات">رواتب ويوميات</option>
                      <option value="صيانة ووقود">صيانة ووقود</option>
                      <option value="إيجار وفواتير">إيجار وفواتير</option>
                      <option value="بوفيه وضيافة">بوفيه وضيافة</option>
                      <option value="مصاريف إدارية">مصاريف إدارية</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="0"
                      value={newExpense.amount}
                      onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                  <textarea
                    rows={2}
                    placeholder="أي تفاصيل أخرى بخصوص المصروف..."
                    value={newExpense.notes}
                    onChange={e => setNewExpense({ ...newExpense, notes: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  ></textarea>
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-3 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-50">
                    {formLoading ? 'جاري الحفظ...' : 'حفظ المصروف'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-5 py-3 rounded-xl font-bold text-sm cursor-pointer">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Expense Modal */}
        {editExpense && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-300 animate-scale-in" dir="rtl">
              <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3">تعديل بند المصروف</h2>
              <form onSubmit={handleUpdateExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">بيان المصروف *</label>
                  <input
                    type="text"
                    required
                    value={editExpense.title || ''}
                    onChange={e => setEditExpense({ ...editExpense, title: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الفئة *</label>
                    <select
                      value={editExpense.category || 'نقل ونولون'}
                      onChange={e => setEditExpense({ ...editExpense, category: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 bg-white"
                    >
                      <option value="نقل ونولون">نقل ونولون</option>
                      <option value="رواتب ويوميات">رواتب ويوميات</option>
                      <option value="صيانة ووقود">صيانة ووقود</option>
                      <option value="إيجار وفواتير">إيجار وفواتير</option>
                      <option value="بوفيه وضيافة">بوفيه وضيافة</option>
                      <option value="مصاريف إدارية">مصاريف إدارية</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={editExpense.amount || ''}
                      onChange={e => setEditExpense({ ...editExpense, amount: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                  <textarea
                    rows={2}
                    value={editExpense.notes || ''}
                    onChange={e => setEditExpense({ ...editExpense, notes: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  ></textarea>
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-3 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-50">
                    {formLoading ? 'جاري الحفظ...' : 'تحديث المصروف'}
                  </button>
                  <button type="button" onClick={() => setEditExpense(null)} className="btn-secondary px-5 py-3 rounded-xl font-bold text-sm cursor-pointer">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
