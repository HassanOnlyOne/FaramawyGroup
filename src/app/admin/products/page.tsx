'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Product } from '@/lib/types';
import { Search, Plus, Edit, Trash2, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNumberFormat } from '@/context/number-format-context';
import { createClient } from '@/lib/supabase/client';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { formatPriceShort, formatNumber } = useNumberFormat();

  const fetchProducts = async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const res = await fetch(`/api/products?limit=200&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      setProducts(data.products || data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    // 1. Auto-polling interval every 8 seconds for live stock sync
    const interval = setInterval(() => {
      fetchProducts(true);
    }, 8000);

    // 2. Refresh on window focus
    const onFocus = () => fetchProducts(true);
    window.addEventListener('focus', onFocus);

    // 3. Supabase Realtime channel subscription
    const supabase = createClient();
    const channel = supabase
      .channel('admin-products-stock-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchProducts(true);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchProducts(true);
    } catch (error) {
      console.error('Error updating product status:', error);
    }
  };

  const deleteProduct = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      try {
        await fetch(`/api/products/${id}`, { method: 'DELETE' });
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku_code || '').includes(searchTerm)
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">إدارة المنتجات والأصناف</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تعديل أسعار الجملة، الكميات، وإضافة أصناف جديدة</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => fetchProducts(false)}
              disabled={refreshing}
              className="btn-secondary py-2.5 px-4 rounded-xl font-bold flex items-center gap-2 shadow text-xs"
              title="تحديث أرصدة المخزون فورياً"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث الأرصدة</span>
            </button>
            <Link href="/admin/products/new" className="btn-primary py-2.5 px-6 rounded-xl font-bold flex items-center gap-2 shadow text-xs">
              <Plus className="w-4 h-4" />
              <span>إضافة صنف جديد</span>
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-4 bg-slate-50 dark:bg-slate-800/60">
            <div className="relative flex-1 max-w-md">
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ابحث برقم SKU أو كود الصنف أو الاسم..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-500 outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-4 whitespace-nowrap">المنتج / SKU</th>
                  <th className="px-5 py-4 whitespace-nowrap">التصنيف</th>
                  <th className="px-5 py-4 whitespace-nowrap">السعر الأساسي</th>
                  <th className="px-5 py-4 whitespace-nowrap">المخزون الحالي</th>
                  <th className="px-5 py-4 whitespace-nowrap text-center">الحالة</th>
                  <th className="px-5 py-4 whitespace-nowrap text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400">جاري التحميل...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-500 dark:text-slate-400">لا توجد منتجات مطابقة</td></tr>
                ) : filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">{product.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {formatNumber(product.sku_code || product.sku)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300 text-xs font-medium">{product.category?.name || 'عام'}</td>
                    <td className="px-5 py-4 font-bold text-slate-900 dark:text-white font-mono text-sm">
                      {formatPriceShort(product.base_price)} /{product.wholesale_unit || product.unit || 'عبوة'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-sm">
                          <span className={product.stock_quantity <= 0 ? 'text-red-600 dark:text-red-400 font-black' : product.stock_quantity <= (product.low_stock_threshold || 10) ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}>
                            {formatNumber(product.stock_quantity)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans font-normal">
                            {product.wholesale_unit || product.unit || 'عبوة'}
                          </span>
                        </div>
                        {product.stock_quantity <= 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> نفد المخزون
                          </span>
                        ) : product.stock_quantity <= (product.low_stock_threshold || 10) ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> مخزون حرج
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => toggleActive(product.id, product.is_active)} className="inline-block">
                        {product.is_active ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/admin/products/${product.id}`} className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button onClick={() => deleteProduct(product.id)} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
