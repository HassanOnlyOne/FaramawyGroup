'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { UserCheck, Plus, Search, Phone, MapPin, Loader2, Edit, Trash2, User, Navigation } from 'lucide-react';

export default function DelegatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [delegates, setDelegates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDelegate, setEditDelegate] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [newDelegate, setNewDelegate] = useState({
    full_name: '',
    phone: '',
    route_name: ''
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelegate.full_name.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم المندوب', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/delegates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newDelegate.full_name.trim(),
          phone: newDelegate.phone.trim(),
          route_name: newDelegate.route_name.trim(),
          territory: newDelegate.route_name.trim()
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.error) {
        toast({ title: 'تم تسجيل المندوب بنجاح', description: `تمت إضافة المندوب (${newDelegate.full_name}) وتعيين خط السير`, type: 'success' });
        setShowAddModal(false);
        setNewDelegate({ full_name: '', phone: '', route_name: '' });
        await fetchDelegates();
        router.refresh();
      } else {
        toast({ 
          title: 'خطأ في حفظ المندوب', 
          description: data.error || 'فشل تسجيل المندوب، يرجى التحقق من البيانات', 
          type: 'error' 
        });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDelegate) return;

    setFormLoading(true);
    try {
      const res = await fetch('/api/delegates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editDelegate.id,
          full_name: editDelegate.full_name?.trim(),
          phone: editDelegate.phone?.trim(),
          route_name: editDelegate.store_name || editDelegate.route_name,
          territory: editDelegate.store_name || editDelegate.route_name
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.error) {
        toast({ title: 'تم تحديث بيانات المندوب بنجاح', type: 'success' });
        setEditDelegate(null);
        await fetchDelegates();
        router.refresh();
      } else {
        toast({ 
          title: 'خطأ في تعديل المندوب', 
          description: data.error || 'فشل تحديث بيانات المندوب', 
          type: 'error' 
        });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteDelegate = async (d: any) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف المندوب "${d.full_name || d.name}"؟`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/delegates?id=${d.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast({ title: 'تم حذف المندوب بنجاح', type: 'success' });
        await fetchDelegates();
        router.refresh();
      } else {
        toast({ title: 'خطأ في حذف المندوب', type: 'error' });
      }
    } catch (err) {
      toast({ title: 'خطأ في الاتصال', type: 'error' });
    }
  };

  const safeDelegates = Array.isArray(delegates) ? delegates : [];
  const filtered = safeDelegates.filter(d =>
    (d.full_name || d.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.store_name || d.route_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.customer_code || '').includes(search) ||
    (d.phone || '').includes(search)
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة مندوبي المبيعات والمشرفين</h1>
            <p className="text-slate-500 text-sm mt-1">تحديد خطوط السير وتتبع فواتير وعملاء كل مندوب</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>إضافة مندوب جديد</span>
            </button>
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="بحث باسم المندوب أو خط السير..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-9 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-4">كود المندوب</th>
                  <th className="p-4">اسم المندوب</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4">خط السير والمنطقة</th>
                  <th className="p-4">الصفة / الرتبة</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                      <span>جاري تحميل قائمة المندوبين...</span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      لا يوجد مندوبين مسجلين مطابقين للبحث
                    </td>
                  </tr>
                ) : (
                  filtered.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-700 text-xs">
                        #{d.customer_code || '---'}
                      </td>
                      <td className="p-4 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs">
                          {d.full_name?.charAt(0) || 'م'}
                        </div>
                        <span>{d.full_name}</span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 text-xs" dir="ltr">
                        {d.phone || '---'}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          <MapPin className="w-3 h-3 text-brand-600" />
                          <span>{d.store_name || d.route_name || 'خط مبيعات عام'}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          مندوب
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditDelegate(d)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDelegate(d)}
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

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-300 animate-scale-in" dir="rtl">
              <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3">إضافة مندوب مبيعات جديد</h2>
              <form onSubmit={handleCreateDelegate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المندوب بالكامل *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: محمود إبراهيم عبد الله"
                    value={newDelegate.full_name}
                    onChange={e => setNewDelegate({ ...newDelegate, full_name: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (للتواصل والواتساب) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="010XXXXXXXX"
                    value={newDelegate.phone}
                    onChange={e => setNewDelegate({ ...newDelegate, phone: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">خط السير / المنطقة المسندة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: قطاع الزقازيق ومنيا القمح"
                    value={newDelegate.route_name}
                    onChange={e => setNewDelegate({ ...newDelegate, route_name: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
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

        {/* Edit Modal */}
        {editDelegate && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-300 animate-scale-in" dir="rtl">
              <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3">تعديل بيانات المندوب</h2>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف *</label>
                  <input
                    type="tel"
                    required
                    value={editDelegate.phone || ''}
                    onChange={e => setEditDelegate({ ...editDelegate, phone: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">خط السير والمنطقة *</label>
                  <input
                    type="text"
                    required
                    value={editDelegate.store_name || editDelegate.route_name || ''}
                    onChange={e => setEditDelegate({ ...editDelegate, store_name: e.target.value, route_name: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
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
      </div>
    </AdminLayout>
  );
}
