'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { Plus, Edit, Trash2, FolderTree, Loader2, Package } from 'lucide-react';
import { useNumberFormat } from '@/context/number-format-context';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const { formatNumber } = useNumberFormat();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    sort_order: '0'
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/categories?t=${Date.now()}`);
      const data = await res.json();
      setCategories(data.data || data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', image_url: '', sort_order: '0' });
    setShowModal(true);
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      image_url: category.image_url || '',
      sort_order: String(category.sort_order || 0)
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم التصنيف', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({
          title: editingCategory ? 'تم تعديل التصنيف بنجاح' : 'تم إضافة التصنيف الجديد بنجاح',
          type: 'success'
        });
        setShowModal(false);
        fetchCategories();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل حفظ التصنيف', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف/تعطيل هذا التصنيف؟')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'تم حذف التصنيف بنجاح', type: 'success' });
        fetchCategories();
      } else {
        toast({ title: 'خطأ في حذف التصنيف', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    }
  };

  const safeCategories = Array.isArray(categories) ? categories : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">الأقسام والتصنيفات</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تنظيم بضائع الجملة حسب الأقسام الرئيسية والفرعية</p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl shadow text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة تصنيف جديد</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
          </div>
        ) : safeCategories.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <FolderTree className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">لا توجد تصنيفات مسجلة حالياً</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">قم بإضافة أقسام المنتجات لتنظيم المتجر وإرشاد العملاء</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {safeCategories.map((category) => {
              const productCount = Array.isArray(category.products) 
                ? (category.products[0]?.count ?? category.products.length)
                : 0;

              return (
                <div
                  key={category.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex items-center justify-between gap-4 hover:shadow-md hover:border-brand-300 dark:hover:border-emerald-500 transition-all group"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shrink-0 flex items-center justify-center">
                      {category.image_url ? (
                        <img src={category.image_url} alt={category.name} className="w-full h-full object-contain" />
                      ) : (
                        <FolderTree className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">{category.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{category.description || 'بدون وصف إضافي'}</p>
                      <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-bold mt-1">
                        <Package className="w-3.5 h-3.5" />
                        <span>{formatNumber(productCount)} منتج مرتبط</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditModal(category)}
                      title="تعديل التصنيف"
                      className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteCategory(category.id)}
                      title="حذف التصنيف"
                      className="p-2 text-slate-600 dark:text-slate-300 hover:text-red-600 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                {editingCategory ? 'تعديل بيانات التصنيف' : 'إضافة تصنيف جديد'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم التصنيف / القسم *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: زيوت وسمن، أرز ومكرونة، معلبات..."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">وصف مختصر للقسم</label>
                <textarea
                  rows={2}
                  placeholder="وصف أصناف القسم..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رابط صورة أو أيقونة (اختياري)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold shadow text-xs"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ التصنيف'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
