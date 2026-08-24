'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { Truck, Plus, Search, Building, Phone, Loader2, Edit, Trash2, DollarSign, FileText } from 'lucide-react';

export default function SuppliersPage() {
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [paymentSupplier, setPaymentSupplier] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    company_name: '',
    phone: '',
    initial_balance: '0',
    notes: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      const res = await fetch(`/api/admin/suppliers?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || json.suppliers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim() && !newSupplier.company_name.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم المورد أو اسم الشركة', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier)
      });
      
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم تسجيل المورد بنجاح', type: 'success' });
        setShowAddModal(false);
        setNewSupplier({ name: '', company_name: '', phone: '', initial_balance: '0', notes: '' });
        await fetchSuppliers();
      } else {
        toast({ title: 'خطأ في حفظ المورد', description: data.error || 'فشل تسجيل المورد في النظام', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplier) return;

    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSupplier)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم تحديث بيانات المورد بنجاح', type: 'success' });
        setEditSupplier(null);
        await fetchSuppliers();
      } else {
        toast({ title: 'خطأ في تعديل المورد', description: data.error || 'فشل حفظ التعديلات', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplier: any) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف المورد "${supplier.name || supplier.company_name}"؟`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/suppliers?id=${supplier.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast({ title: 'تم حذف المورد بنجاح', type: 'success' });
        await fetchSuppliers();
      } else {
        toast({ title: 'خطأ في حذف المورد', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    }
  };

  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplier || !paymentAmount || Number(paymentAmount) <= 0) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال مبلغ صحيح للدفعة', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paymentSupplier.id,
          payment_amount: Number(paymentAmount),
          notes: paymentNotes ? `[سداد دفعة للمورد: ${paymentAmount} ج.م] - ${paymentNotes}` : `سداد دفعة نقدية بقيمة ${paymentAmount} ج.م`
        })
      });

      if (res.ok) {
        toast({ title: 'تم تسجيل سداد الدفعة وخصمها من رصيد المورد بنجاح', type: 'success' });
        setPaymentSupplier(null);
        setPaymentAmount('');
        setPaymentNotes('');
        await fetchSuppliers();
      } else {
        toast({ title: 'خطأ في تسجيل الدفعة', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const filtered = safeSuppliers.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  );

  const totalSupplierDebt = safeSuppliers.reduce((sum, s) => sum + Number(s.current_balance || s.balance || s.current_debt || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">دليل الموردين والشركات</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تسجيل الموردين والمستوردين، وتتبع الأرصدة وسداد الدفعات</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 font-bold px-4 py-2.5 text-xs rounded-xl shadow">
              <Plus className="w-4 h-4" />
              <span>إضافة مورد جديد</span>
            </button>
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="بحث بالمورد أو الشركة..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-9 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي المستحقات للموردين</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{formatPriceShort(totalSupplierDebt)}</span>
            </div>
            <div className="w-12 h-12 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">إجمالي عدد الموردين المسجلين</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{formatNumber(safeSuppliers.length)} مورد</span>
            </div>
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl flex items-center justify-center">
              <Building className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">اسم المورد / المسؤول</th>
                  <th className="p-4 whitespace-nowrap">الشركة / المصنع</th>
                  <th className="p-4 whitespace-nowrap">الهاتف</th>
                  <th className="p-4 whitespace-nowrap">الرصيد المستحق (له)</th>
                  <th className="p-4 whitespace-nowrap">ملاحظات</th>
                  <th className="p-4 whitespace-nowrap text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">لا يوجد موردين مسجلون</td></tr>
                ) : (
                  filtered.map(s => {
                    const supDebt = Number(s.current_balance !== undefined && s.current_balance !== null ? s.current_balance : (s.balance !== undefined && s.balance !== null ? s.balance : (s.current_debt || 0)));
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{s.name}</td>
                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{s.company_name || '---'}</td>
                        <td className="p-4 font-mono font-medium text-xs" dir="ltr">{formatNumber(s.phone || '---')}</td>
                        <td className="p-4 font-bold text-red-600 dark:text-red-400 font-mono text-base">{formatPriceShort(supDebt)}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-400 text-xs">{s.notes || '---'}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setPaymentSupplier(s);
                                setPaymentAmount('');
                                setPaymentNotes('');
                              }}
                              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              title="سداد دفعة نقدية للمورد"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>سداد دفعة</span>
                            </button>
                            <button
                              onClick={() => setEditSupplier({ ...s })}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                              title="تعديل بيانات المورد"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(s)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                              title="حذف المورد"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300">إضافة مورد جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم المورد / المسؤول *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  value={newSupplier.name}
                  onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم الشركة / المصنع المورد</label>
                <input
                  type="text"
                  placeholder="مثال: مصنع الأهرام للزيوت / شركة الفيروز"
                  value={newSupplier.company_name}
                  onChange={e => setNewSupplier({ ...newSupplier, company_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رقم الهاتف للتواصل</label>
                <input
                  type="tel"
                  placeholder="010XXXXXXXX"
                  value={newSupplier.phone}
                  onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رصيد افتتاحي مستحق للمورد (إن وجد)</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="0"
                  value={newSupplier.initial_balance}
                  onChange={e => setNewSupplier({ ...newSupplier, initial_balance: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  placeholder="أي ملاحظات حول التوريد أو التعامل..."
                  value={newSupplier.notes}
                  onChange={e => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold shadow text-xs"
                >
                  {formLoading ? 'جاري الحفظ...' : 'حفظ المورد'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-blue-50 dark:bg-blue-950/60">
              <h3 className="font-bold text-base text-blue-900 dark:text-blue-300">تعديل بيانات المورد</h3>
              <button onClick={() => setEditSupplier(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleUpdateSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم المورد / المسؤول *</label>
                <input
                  type="text"
                  required
                  value={editSupplier.name || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم الشركة / المصنع</label>
                <input
                  type="text"
                  value={editSupplier.company_name || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, company_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الهاتف</label>
                <input
                  type="tel"
                  value={editSupplier.phone || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الرصيد المستحق الحالي (ج.م)</label>
                <input
                  type="number"
                  value={editSupplier.balance ?? editSupplier.current_balance ?? 0}
                  onChange={e => setEditSupplier({ ...editSupplier, balance: parseFloat(e.target.value) || 0, current_balance: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">ملاحظات</label>
                <textarea
                  rows={2}
                  value={editSupplier.notes || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold shadow text-xs"
                >
                  {formLoading ? 'جاري التعديل...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditSupplier(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {paymentSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                سداد دفعة نقدية للمورد
              </h3>
              <button onClick={() => setPaymentSupplier(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleRecordSupplierPayment} className="p-5 space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">المورد المستلم:</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{paymentSupplier.name} ({paymentSupplier.company_name || 'شركة موردة'})</p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">الرصيد المستحق الحالي له:</span>
                  <span className="font-bold text-red-600 dark:text-red-400 font-mono">{formatPriceShort(Number(paymentSupplier.current_balance || paymentSupplier.balance || 0))}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">المبلغ المسدد نقداً (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="ادخل قيمة الدفعة المسددة (مثال: 1000)"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 rounded-xl text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">البيان / ملاحظات السند</label>
                <input
                  type="text"
                  placeholder="مثال: دفعة نقدية تحت حساب توريد زيوت"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold shadow text-xs"
                >
                  {formLoading ? 'جاري تسجيل الدفعة...' : 'تأكيد السداد والخصم من الرصيد'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSupplier(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
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
