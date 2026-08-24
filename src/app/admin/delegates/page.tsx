'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { UserCheck, Plus, Search, Phone, MapPin, Loader2, Edit, Trash2 } from 'lucide-react';

export default function DelegatesPage() {
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
        body: JSON.stringify(newDelegate)
      });
      if (res.ok) {
        toast({ title: 'تم تسجيل المندوب بنجاح', type: 'success' });
        setShowAddModal(false);
        setNewDelegate({ full_name: '', phone: '', route_name: '' });
        await fetchDelegates();
      } else {
        toast({ title: 'خطأ في حفظ المندوب', type: 'error' });
      }
    } catch (err) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', type: 'error' });
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
          full_name: editDelegate.full_name,
          phone: editDelegate.phone,
          route_name: editDelegate.store_name || editDelegate.route_name
        })
      });

      if (res.ok) {
        toast({ title: 'تم تحديث بيانات المندوب بنجاح', type: 'success' });
        setEditDelegate(null);
        await fetchDelegates();
      } else {
        toast({ title: 'خطأ في تعديل المندوب', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
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
      } else {
        toast({ title: 'خطأ في حذف المندوب', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
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
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl">
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
                  <th className="p-4 whitespace-nowrap">كود المندوب</th>
                  <th className="p-4 whitespace-nowrap">اسم المندوب</th>
                  <th className="p-4 whitespace-nowrap">الهاتف</th>
                  <th className="p-4 whitespace-nowrap">خط السير / المنطقة</th>
                  <th className="p-4 whitespace-nowrap">الصلاحية</th>
                  <th className="p-4 whitespace-nowrap text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">لا يوجد مندوبين مسجلون</td></tr>
                ) : (
                  filtered.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-emerald-700 bg-emerald-50/60 px-3 py-1 rounded-md text-xs">{d.customer_code ? String(d.customer_code).replace(/\D/g, '') : '501'}</td>
                      <td className="p-4 font-bold text-slate-900">{d.full_name || d.name}</td>
                      <td className="p-4 font-semibold font-mono" dir="ltr">{d.phone || '---'}</td>
                      <td className="p-4 text-slate-800">{d.store_name || d.route_name || 'خط عام'}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          مندوب مبيعات
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditDelegate({ ...d })}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200"
                            title="تعديل بيانات المندوب"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDelegate(d)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
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
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-emerald-50">
              <h3 className="font-bold text-lg text-emerald-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                تسجيل مندوب مبيعات جديد
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateDelegate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">اسم المندوب بالكامل *</label>
                <input type="text" required placeholder="مثال: محمود علي" value={newDelegate.full_name} onChange={e => setNewDelegate({...newDelegate, full_name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">رقم الهاتف *</label>
                <input type="tel" required placeholder="01000000000" value={newDelegate.phone} onChange={e => setNewDelegate({...newDelegate, phone: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">خط السير / المنطقة المخصصة</label>
                <input type="text" placeholder="مثال: خط وسط البلد والمحطة" value={newDelegate.route_name} onChange={e => setNewDelegate({...newDelegate, route_name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={formLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-all shadow">
                  {formLoading ? 'جاري التسجيل...' : 'حفظ المندوب'}
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 text-slate-800 py-2.5 rounded-xl font-bold border border-slate-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editDelegate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
              <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                تعديل بيانات المندوب
              </h3>
              <button onClick={() => setEditDelegate(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleUpdateDelegate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">اسم المندوب بالكامل *</label>
                <input type="text" required value={editDelegate.full_name || editDelegate.name || ''} onChange={e => setEditDelegate({...editDelegate, full_name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">رقم الهاتف</label>
                <input type="tel" value={editDelegate.phone || ''} onChange={e => setEditDelegate({...editDelegate, phone: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-mono" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">خط السير / المنطقة المخصصة</label>
                <input type="text" value={editDelegate.store_name || editDelegate.route_name || ''} onChange={e => setEditDelegate({...editDelegate, store_name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={formLoading} className="flex-1 btn-primary py-2.5 rounded-xl font-bold shadow">
                  {formLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button type="button" onClick={() => setEditDelegate(null)} className="flex-1 bg-slate-100 text-slate-800 py-2.5 rounded-xl font-bold border border-slate-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
