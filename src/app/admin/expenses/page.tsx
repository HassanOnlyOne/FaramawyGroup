'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { formatPriceShort } from '@/lib/constants';
import { useToast } from '@/components/ui/toast';
import { CreditCard, Plus, Search, Loader2, Edit, Trash2 } from 'lucide-react';

export default function ExpensesPage() {
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
    setFormLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExpense)
      });
      if (res.ok) {
        toast({ title: 'تم تسجيل المصروف بنجاح', type: 'success' });
        setShowModal(false);
        setNewExpense({ title: '', category: 'نقل ونولون', amount: '', notes: '' });
        await fetchExpenses();
      } else {
        toast({ title: 'خطأ في حفظ المصروف', type: 'error' });
      }
    } catch (err) {
      toast({ title: 'خطأ في الاتصال', type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;

    setFormLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editExpense)
      });
      if (res.ok) {
        toast({ title: 'تم تحديث بيانات المصروف بنجاح', type: 'success' });
        setEditExpense(null);
        await fetchExpenses();
      } else {
        toast({ title: 'خطأ في تعديل المصروف', type: 'error' });
      }
    } catch (err) {
      toast({ title: 'خطأ في الاتصال', type: 'error' });
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
    (e.category || '').toLowerCase().includes(search.toLowerCase())
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
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl">
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
          <span className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200">
            عدد البنود: {safeExpenses.length}
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-4 whitespace-nowrap">التاريخ</th>
                  <th className="p-4 whitespace-nowrap">بيان المصروف</th>
                  <th className="p-4 whitespace-nowrap">الفئة / القسم</th>
                  <th className="p-4 whitespace-nowrap">المبلغ</th>
                  <th className="p-4 whitespace-nowrap">ملاحظات</th>
                  <th className="p-4 whitespace-nowrap text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">لا توجد مصروفات مسجلة</td></tr>
                ) : (
                  filtered.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-slate-600 font-medium whitespace-nowrap text-xs">
                        {new Date(e.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-4 font-bold text-slate-900">{e.title}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {e.category}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-red-600 text-base font-mono">{formatPriceShort(Number(e.amount || 0))}</td>
                      <td className="p-4 text-slate-600 text-xs">{e.notes || '---'}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditExpense({ ...e })}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                            title="تعديل بيانات المصروف"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(e)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                            title="حذف المصروف"
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
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-lg text-red-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-red-600" />
                تسجيل بند مصروفات جديد
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateExpense} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">بيان المصروف *</label>
                <input type="text" required placeholder="مثال: بنزين ونولون سيارة التوزيع" value={newExpense.title} onChange={e => setNewExpense({...newExpense, title: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">فئة المصروف *</label>
                <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 bg-white">
                  <option value="نقل ونولون">نقل ونولون وسيارة التوزيع</option>
                  <option value="إيجار ومرافق">إيجار المخزن والكهرباء</option>
                  <option value="مرتبات وعمالة">مرتبات المندوبين والعمالة</option>
                  <option value="صيانة ومستلزمات">صيانة أدوات ومستلزمات</option>
                  <option value="مصروفات إدارية">مصروفات إدارية متنوعة</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">المبلغ (ج.م) *</label>
                <input type="number" required step="0.01" placeholder="350" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">ملاحظات إضافية</label>
                <textarea rows={2} placeholder="تفاصيل الإيصال..." value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm"></textarea>
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={formLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition-all shadow">
                  {formLoading ? 'جاري التسجيل...' : 'حفظ المصروف'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-800 py-2.5 rounded-xl font-bold border border-slate-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editExpense && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
              <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                تعديل بند المصروف
              </h3>
              <button onClick={() => setEditExpense(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleUpdateExpense} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">بيان المصروف *</label>
                <input type="text" required value={editExpense.title || ''} onChange={e => setEditExpense({...editExpense, title: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">فئة المصروف *</label>
                <select value={editExpense.category || 'نقل ونولون'} onChange={e => setEditExpense({...editExpense, category: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 bg-white">
                  <option value="نقل ونولون">نقل ونولون وسيارة التوزيع</option>
                  <option value="إيجار ومرافق">إيجار المخزن والكهرباء</option>
                  <option value="مرتبات وعمالة">مرتبات المندوبين والعمالة</option>
                  <option value="صيانة ومستلزمات">صيانة أدوات ومستلزمات</option>
                  <option value="مصروفات إدارية">مصروفات إدارية متنوعة</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">المبلغ (ج.م) *</label>
                <input type="number" required step="0.01" value={editExpense.amount || 0} onChange={e => setEditExpense({...editExpense, amount: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">ملاحظات إضافية</label>
                <textarea rows={2} value={editExpense.notes || ''} onChange={e => setEditExpense({...editExpense, notes: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm"></textarea>
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-2.5 rounded-xl font-bold shadow">
                  {formLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button type="button" onClick={() => setEditExpense(null)} className="flex-1 bg-slate-100 text-slate-800 py-2.5 rounded-xl font-bold border border-slate-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
