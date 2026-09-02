'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { 
  Plus, 
  Search, 
  Loader2, 
  Edit, 
  Trash2, 
  User, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle,
  Users
} from 'lucide-react';

export default function DelegatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [delegates, setDelegates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDelegate, setEditDelegate] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [newDelegate, setNewDelegate] = useState({
    full_name: '',
    phone: '',
    territory: '',
    notes: '',
    is_active: true
  });

  useEffect(() => {
    fetchDelegates();
  }, []);

  async function fetchDelegates() {
    try {
      const res = await fetch(`/api/delegates?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setDelegates(json.data || json.delegates || []);
      } else {
        const { data } = await supabase
          .from('delegates')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setDelegates(data);
      }
    } catch (err) {
      console.error('Fetch delegates error:', err);
      try {
        const { data } = await supabase
          .from('delegates')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setDelegates(data);
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  const handleCreateDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newDelegate.full_name.trim();
    if (!trimmedName) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم المندوب', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        full_name: trimmedName,
        phone: newDelegate.phone.trim() || null,
        territory: newDelegate.territory.trim() || 'خط مبيعات عام',
        notes: newDelegate.notes.trim() || null,
        is_active: newDelegate.is_active
      };

      const res = await fetch('/api/delegates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.error) {
        toast({ title: 'تم تسجيل المندوب بنجاح', description: `تم تسجيل المندوب (${trimmedName})`, type: 'success' });
        setShowAddModal(false);
        setNewDelegate({ full_name: '', phone: '', territory: '', notes: '', is_active: true });
        await fetchDelegates();
        router.refresh();
      } else {
        toast({ title: 'خطأ في حفظ المندوب', description: data.error || 'تعذر تسجيل المندوب', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDelegate || !editDelegate.full_name?.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم المندوب', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        id: editDelegate.id,
        full_name: editDelegate.full_name.trim(),
        phone: editDelegate.phone?.trim() || null,
        territory: (editDelegate.territory || editDelegate.store_name || editDelegate.route_name || '').trim(),
        is_active: editDelegate.is_active !== false,
        notes: editDelegate.notes?.trim() || null
      };

      const res = await fetch('/api/delegates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.error) {
        toast({ title: 'تم تحديث بيانات المندوب بنجاح', type: 'success' });
        setEditDelegate(null);
        await fetchDelegates();
        router.refresh();
      } else {
        toast({ title: 'خطأ في تعديل المندوب', description: data.error || 'فشل تحديث بيانات المندوب', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setFormLoading(true);
    try {
      const targetName = deleteTarget.full_name || 'المندوب';
      const res = await fetch(`/api/delegates?id=${deleteTarget.id}&name=${encodeURIComponent(targetName)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.error) {
        toast({ title: 'تم حذف المندوب بنجاح', type: 'success' });
        setDeleteTarget(null);
        await fetchDelegates();
        router.refresh();
      } else {
        toast({ title: 'خطأ في حذف المندوب', description: data.error || 'تعذر حذف المندوب', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const safeDelegates = Array.isArray(delegates) ? delegates : [];
  const filtered = safeDelegates.filter(d =>
    (d.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.territory || d.store_name || d.route_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.customer_code || '').includes(search)
  );

  const activeCount = safeDelegates.filter(d => d.is_active !== false).length;
  const territoriesCount = new Set(safeDelegates.map(d => d.territory || d.store_name || d.route_name).filter(Boolean)).size;

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">سجل مندوبي المبيعات والمشرفين</h1>
            <p className="text-slate-500 text-sm mt-1">سجل إداري وتنظيمي لتحديد خطوط السير وتتبع فواتير وعملاء كل مندوب</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl cursor-pointer shadow-md">
              <Plus className="w-4 h-4" />
              <span>إضافة مندوب جديد</span>
            </button>
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="بحث بالمندوب أو خط السير..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-9 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* 3 Top Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي المناديب المسجلين</span>
              <span className="text-2xl font-black text-slate-900 font-mono">{safeDelegates.length}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-1">المناديب النشطون في الخدمة</span>
              <span className="text-2xl font-black text-emerald-600 font-mono">{activeCount}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-1">خطوط السير المغطاة</span>
              <span className="text-2xl font-black text-blue-600 font-mono">{territoriesCount}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <MapPin className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Delegates Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-4">كود المندوب</th>
                  <th className="p-4">اسم المندوب</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4">خط السير / المنطقة</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">ملاحظات</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                      <span>جاري تحميل سجل المندوبين...</span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                      لا يوجد مندوبين مطابقين للبحث
                    </td>
                  </tr>
                ) : (
                  filtered.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-700 text-xs">
                        #{d.customer_code || '501'}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0 border border-brand-200">
                            {d.full_name?.charAt(0) || 'م'}
                          </div>
                          <span>{d.full_name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 text-xs" dir="ltr">
                        {d.phone || '---'}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                          <span>{d.territory || d.store_name || d.route_name || 'خط مبيعات عام'}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        {d.is_active !== false ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>نشط</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <span>معطل</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-500 max-w-xs truncate">
                        {d.notes || '---'}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditDelegate({
                              ...d,
                              territory: d.territory || d.store_name || d.route_name || ''
                            })}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل بيانات المندوب"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(d)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف المندوب"
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

        {/* Add Delegate Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-300 animate-scale-in" dir="rtl">
              <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-600" />
                <span>إضافة مندوب جديد للسجل الإداري</span>
              </h2>
              <form onSubmit={handleCreateDelegate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المندوب بالكامل *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الرحمن إبراهيم"
                    value={newDelegate.full_name}
                    onChange={e => setNewDelegate({ ...newDelegate, full_name: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (للتواصل والواتساب)</label>
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    value={newDelegate.phone}
                    onChange={e => setNewDelegate({ ...newDelegate, phone: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500 text-right"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">دفتر عناوين حر: يمكنك إدخال أي رقم هاتف بدون قيود.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">خط السير والمنطقة المسندة</label>
                  <input
                    type="text"
                    placeholder="مثال: قطاع الزقازيق، بلبيس، ومنيا القمح"
                    value={newDelegate.territory}
                    onChange={e => setNewDelegate({ ...newDelegate, territory: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إدارية إضافية</label>
                  <textarea
                    rows={2}
                    placeholder="مثال: رقم لوحة السيارة، مواعيد الزيارات..."
                    value={newDelegate.notes}
                    onChange={e => setNewDelegate({ ...newDelegate, notes: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  ></textarea>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="add_is_active"
                    checked={newDelegate.is_active}
                    onChange={e => setNewDelegate({ ...newDelegate, is_active: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                  />
                  <label htmlFor="add_is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
                    حالة المندوب: نشط ومتاح للعمل
                  </label>
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-3 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-50">
                    {formLoading ? 'جاري الحفظ...' : 'حفظ المندوب'}
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary px-5 py-3 rounded-xl font-bold text-sm cursor-pointer">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Delegate Modal */}
        {editDelegate && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-300 animate-scale-in" dir="rtl">
              <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                <span>تعديل بيانات المندوب</span>
              </h2>
              <form onSubmit={handleUpdateDelegate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المندوب *</label>
                  <input
                    type="text"
                    required
                    value={editDelegate.full_name || ''}
                    onChange={e => setEditDelegate({ ...editDelegate, full_name: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={editDelegate.phone || ''}
                    onChange={e => setEditDelegate({ ...editDelegate, phone: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500 text-right"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">خط السير والمنطقة</label>
                  <input
                    type="text"
                    value={editDelegate.territory || editDelegate.store_name || editDelegate.route_name || ''}
                    onChange={e => setEditDelegate({ ...editDelegate, territory: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إدارية</label>
                  <textarea
                    rows={2}
                    value={editDelegate.notes || ''}
                    onChange={e => setEditDelegate({ ...editDelegate, notes: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  ></textarea>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editDelegate.is_active !== false}
                    onChange={e => setEditDelegate({ ...editDelegate, is_active: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                  />
                  <label htmlFor="edit_is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
                    حالة المندوب: نشط ومتاح للعمل
                  </label>
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-3 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-50">
                    {formLoading ? 'جاري الحفظ...' : 'تحديث البيانات'}
                  </button>
                  <button type="button" onClick={() => setEditDelegate(null)} className="btn-secondary px-5 py-3 rounded-xl font-bold text-sm cursor-pointer">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-scale-in" dir="rtl">
              <div className="flex items-center gap-3 text-red-600 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">تأكيد حذف المندوب</h3>
                  <p className="text-xs text-slate-500">عملية الحذف نهائية وسيتم توثيقها في سجل النظام</p>
                </div>
              </div>

              <p className="text-sm text-slate-700 my-4 bg-red-50/70 p-3.5 rounded-2xl border border-red-200 font-medium">
                هل أنت متأكد من رغبتك في حذف المندوب <strong className="font-bold text-red-700">({deleteTarget.full_name})</strong> من سجلات المناديب؟
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={formLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? 'جاري الحذف...' : 'نعم، حذف المندوب'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={formLoading}
                  className="btn-secondary px-5 py-3 rounded-xl font-bold text-sm cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
