'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/layout/admin-layout';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { ArrowRight, Save, Plus, Trash2, Loader2 } from 'lucide-react';

const UNITS = ['كجم', 'جرام', 'قطعة', 'لتر', 'مل', 'عبوة', 'كرتونة'];

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category_id: '',
    description: '',
    image_url: '',
    unit: 'كجم',
    base_price: '',
    stock_quantity: '',
    low_stock_threshold: '10',
    is_active: true
  });

  const [pricingTiers, setPricingTiers] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(res => res.json()),
      fetch(`/api/products/${id}`).then(res => res.json())
    ]).then(([catsData, productData]) => {
      setCategories(catsData.data || catsData.categories || []);
      const p = productData.data || productData.product || (productData.id ? productData : null);
      if (p) {
        setFormData({
          name: p.name || '',
          sku: p.sku || '',
          category_id: p.category_id || '',
          description: p.description || '',
          image_url: (p.images && p.images[0]) ? p.images[0] : '',
          unit: p.unit || 'عبوة',
          base_price: (p.base_price || 0).toString(),
          stock_quantity: (p.stock_quantity || 0).toString(),
          low_stock_threshold: (p.low_stock_threshold || 10).toString(),
          is_active: p.is_active !== undefined ? p.is_active : true
        });
        setPricingTiers(p.pricing_tiers || []);
      }
      setIsLoading(false);
    }).catch(() => {
      toast({ title: 'خطأ', description: 'فشل تحميل البيانات', type: 'error' });
      router.push('/admin/products');
    });
  }, [id, router, toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handleTierChange = (index: number, field: string, value: string) => {
    const newTiers = [...pricingTiers];
    newTiers[index] = { ...newTiers[index], [field]: value === '' ? null : Number(value) };
    setPricingTiers(newTiers);
  };

  const addTier = () => {
    setPricingTiers([...pricingTiers, { min_quantity: 0, max_quantity: null, price_per_unit: '' as any }]);
  };

  const removeTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const validTiers = pricingTiers.filter(t => t.min_quantity && t.price_per_unit);
      
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          images: formData.image_url ? [formData.image_url] : [],
          base_price: Number(formData.base_price),
          stock_quantity: Number(formData.stock_quantity),
          low_stock_threshold: Number(formData.low_stock_threshold),
          pricing_tiers: validTiers
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok || data.success || data.product || data.data) {
        toast({ title: 'تم تعديل المنتج بنجاح', type: 'success' });
        router.push('/admin/products');
      } else if (res.status === 401) {
        toast({ title: 'غير مصرح', description: 'يرجى تسجيل الدخول كمسؤول للمتابعة', type: 'error' });
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل في حفظ المنتج', type: 'error' });
      }
    } catch (error: any) {
      toast({ title: 'خطأ', description: error?.message || 'حدث خطأ أثناء حفظ المنتج', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <AdminLayout><div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-8">
        <Link href="/admin/products" className="inline-flex items-center gap-2 text-slate-500 hover:text-navy-900 mb-4 transition-colors">
          <ArrowRight className="w-4 h-4" />
          <span>العودة للمنتجات</span>
        </Link>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">تعديل المنتج</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">اسم المنتج *</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">رقم المنتج (اختياري)</label>
              <input type="text" name="sku" value={formData.sku} onChange={handleChange} placeholder="مثال: 101 أو اتركه فارغاً" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">التصنيف *</label>
              <select name="category_id" required value={formData.category_id} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none">
                <option value="">اختر تصنيف...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">الوحدة *</label>
              <select name="unit" required value={formData.unit} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 space-y-3">
              <label className="block text-sm font-bold text-slate-900 mb-1">صورة المنتج (رفع محلي من الجهاز أو رابط URL)</label>
              
              <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                {/* File Upload Input */}
                <label className="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-300 rounded-xl p-3 flex items-center justify-center gap-2 text-slate-700 text-sm font-bold transition-all">
                  <span>📁 اختر صورة من جهازك...</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setFormData(prev => ({ ...prev, image_url: base64 }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                {/* OR URL Input */}
                <input 
                  type="url" 
                  name="image_url" 
                  placeholder="أو اكتب رابط صورة مباشر (URL)..." 
                  value={formData.image_url.startsWith('data:') ? '' : formData.image_url} 
                  onChange={handleChange} 
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-slate-900 text-sm" 
                  dir="ltr"
                />
              </div>

              {formData.image_url && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600">معاينة الصورة المحددة:</span>
                    <img 
                      src={formData.image_url} 
                      alt="معاينة المنتج" 
                      className="w-20 h-20 object-contain rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setFormData({ ...formData, image_url: '' })}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    إزالة الصورة
                  </button>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-navy-700 mb-2">الوصف</label>
              <textarea name="description" rows={3} value={formData.description} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none"></textarea>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">السعر الأساسي (ج.م) *</label>
              <input type="number" step="0.01" name="base_price" required value={formData.base_price} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">كمية المخزون *</label>
              <input type="number" name="stock_quantity" required value={formData.stock_quantity} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-navy-700 mb-2">حد نقص المخزون</label>
              <input type="number" name="low_stock_threshold" required value={formData.low_stock_threshold} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-navy-900">أسعار الجملة (شرائح التسعير)</h2>
            <button type="button" onClick={addTier} className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 text-sm">
              <Plus className="w-4 h-4" /> إضافة شريحة
            </button>
          </div>
          
          <div className="space-y-4">
            {pricingTiers.map((tier, idx) => (
              <div key={idx} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">الحد الأدنى</label>
                  <input type="number" required value={tier.min_quantity || ''} onChange={(e) => handleTierChange(idx, 'min_quantity', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">الحد الأقصى</label>
                  <input type="number" value={tier.max_quantity || ''} onChange={(e) => handleTierChange(idx, 'max_quantity', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">السعر (ج.م)</label>
                  <input type="number" step="0.01" required value={tier.price_per_unit || ''} onChange={(e) => handleTierChange(idx, 'price_per_unit', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                </div>
                <button type="button" onClick={() => removeTier(idx)} className="p-2.5 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4 pb-12">
          <button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl">
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
