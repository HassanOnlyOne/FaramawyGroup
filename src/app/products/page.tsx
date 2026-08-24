'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { ProductCard } from '@/components/products/product-card';
import { Search, Filter, Loader2 } from 'lucide-react';

function ProductsContent() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('search') || '';

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        const rawList = data.categories || data.data || data;
        setCategories(Array.isArray(rawList) ? rawList : []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const timerId = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 1500);

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        let url = '/api/products?';
        if (currentCategory) url += `category=${currentCategory}&`;
        if (currentSearch) url += `search=${encodeURIComponent(currentSearch)}&`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const rawList = data.products || data.data || data;
          if (isMounted) setProducts(Array.isArray(rawList) ? rawList : []);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        if (isMounted) setIsLoading(false);
        clearTimeout(timerId);
      }
    };

    fetchProducts();

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [currentCategory, currentSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchTerm) {
      params.set('search', searchTerm);
    } else {
      params.delete('search');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCategorySelect = (categoryId: string) => {
    const params = new URLSearchParams(searchParams);
    if (categoryId === currentCategory) {
      params.delete('category');
    } else {
      params.set('category', categoryId);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <div className="py-8 max-w-7xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">بضائع ومنتجات الجملة</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تصفح كافة الأصناف الغذائية والتوريدات بأسعار الجملة المحدثة</p>
        </div>
        
        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث عن صنف، شركة، أو كود..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-brand-500 dark:focus:border-emerald-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm font-semibold shadow-sm"
          />
          <button type="submit" className="absolute left-3 top-3.5 text-slate-400 hover:text-emerald-500">
            <Search className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Categories Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm sticky top-24 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              أقسام التوريدات
            </h3>
            
            <div className="space-y-1.5">
              <button
                onClick={() => handleCategorySelect('')}
                className={`w-full text-right px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold ${
                  !currentCategory 
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                جميع الأقسام (الكل)
              </button>
              
              {safeCategories.map((cat) => {
                const isSelected = currentCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`w-full text-right px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold ${
                      isSelected 
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm' 
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-10 h-10 text-brand-600 dark:text-emerald-400 animate-spin" />
            </div>
          ) : safeProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {safeProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <p className="text-slate-600 dark:text-slate-300 font-bold mb-2">لا توجد منتجات مطابقة لخيارات البحث</p>
              <p className="text-xs text-slate-400 mb-4">جرب البحث بكلمات أخرى أو اختر قسماً مختلفاً</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  router.push(pathname);
                }}
                className="btn-primary text-xs px-5 py-2.5 rounded-xl font-bold"
              >
                عرض كل المنتجات
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <CustomerLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      }>
        <ProductsContent />
      </Suspense>
    </CustomerLayout>
  );
}