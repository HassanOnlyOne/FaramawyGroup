'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { ProductCard } from '@/components/products/product-card';
import { 
  Loader2, 
  ArrowLeft, 
  Droplet, 
  Wheat, 
  Sparkles, 
  ShieldCheck, 
  Milk, 
  ShoppingBag, 
  Package, 
  CupSoda, 
  Truck, 
  CreditCard, 
  CheckCircle2,
  PhoneCall
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  'زيوت وسمن': { icon: Droplet, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900' },
  'أرز ومكرونة': { icon: Wheat, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900' },
  'سكر وشاي': { icon: Sparkles, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900' },
  'منظفات': { icon: ShieldCheck, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-900' },
  'مشروبات': { icon: CupSoda, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900' },
  'ألبان وأجبان': { icon: Milk, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-900' },
  'معلبات': { icon: Package, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900' },
  'مستلزمات بقالة': { icon: ShoppingBag, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900' },
};

export default function HomePage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadPublicData = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const [catRes, prodRes] = await Promise.allSettled([
        fetch('/api/categories', { cache: 'no-store' }),
        fetch('/api/products?limit=50', { cache: 'no-store' })
      ]);

      if (catRes.status === 'fulfilled' && catRes.value.ok) {
        const catData = await catRes.value.json();
        const list = Array.isArray(catData) ? catData : (catData.categories || catData.data || []);
        setCategories(list);
      }

      if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
        const prodData = await prodRes.value.json();
        const list = Array.isArray(prodData) ? prodData : (prodData.products || prodData.data || []);
        setFeaturedProducts(list);
      }
    } catch (error) {
      console.error('Error fetching homepage data:', error);
      setHasError(true);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const timerId = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 1500);

    loadPublicData();

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, []);

  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeProducts = Array.isArray(featuredProducts) ? featuredProducts : [];

  return (
    <CustomerLayout>
      <div className="space-y-8 py-6 max-w-7xl mx-auto px-4">
        {/* Modern Hero Banner Section */}
        <div className="relative rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-slate-950 text-white p-6 sm:p-10 shadow-2xl overflow-hidden border border-brand-800/80">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#42a5f5_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-amber-500/30 text-amber-300 text-xs px-3.5 py-1.5 rounded-full font-bold border border-amber-400/40 backdrop-blur-md shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-amber-300 font-bold">الفرماوي جروب للتجارة والتوزيع — كبرى التوريدات بالجملة</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black leading-tight text-white drop-shadow-md tracking-tight">
              أفضل أسعار التوريد بالجملة والتجزئة للمحلات والسوبرماركت
            </h1>

            <p className="text-slate-200 font-medium text-sm sm:text-base leading-relaxed max-w-xl">
              منصة التوريدات الرقمية الأولى المعتمدة: اطلب كل مستلزمات بقالتك ومحلك بضغطة واحدة، بأسعار المصنع المباشرة وتوصيل مجاني سريـع.
            </p>

            {/* Feature Badges Strip */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 text-white px-3.5 py-2 rounded-xl backdrop-blur-md border border-white/20 shadow-sm">
                <Truck className="w-4 h-4 text-amber-400" /> <span className="text-white">توريد سريع للمخازن</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 text-white px-3.5 py-2 rounded-xl backdrop-blur-md border border-white/20 shadow-sm">
                <CreditCard className="w-4 h-4 text-emerald-400" /> <span className="text-white">دفع كاش وأجل للعملاء</span>
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3 pt-4 flex-wrap">
              <Link href="/products" className="btn-accent px-6 py-3 text-sm font-bold flex items-center gap-2 rounded-xl shadow-lg">
                <ShoppingBag className="w-4 h-4" />
                <span>تصفح بضائع الجملة</span>
              </Link>
              <a href="tel:01066918217" className="bg-white/15 hover:bg-white/25 text-white border border-white/30 px-5 py-3 text-sm font-bold flex items-center gap-2 rounded-xl transition-all shadow-sm">
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span className="text-white">طلب توريد تلفوني</span>
              </a>
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">الأقسام الرئيسية للجملة</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">اختر القسم لمشاهدة جميع بضائع وتوريدات المصنع</p>
            </div>
            <Link href="/products" className="text-brand-600 dark:text-emerald-400 text-xs sm:text-sm font-bold flex items-center gap-1 hover:underline">
              عرض الكل <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-brand-600 dark:text-emerald-400 animate-spin" />
            </div>
          ) : safeCategories.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {safeCategories.map((cat) => {
                const config = CATEGORY_ICONS[cat.name] || { icon: Package, color: 'text-brand-600 dark:text-emerald-400', bg: 'bg-brand-50 dark:bg-slate-800 border-brand-200 dark:border-slate-700' };
                const Icon = config.icon;

                return (
                  <Link
                    key={cat.id || cat.slug || Math.random()}
                    href={`/products?category=${cat.id}`}
                    className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:border-brand-400 dark:hover:border-emerald-500 hover:scale-[1.03] transition-all group text-center"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 border ${config.bg} group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 leading-tight group-hover:text-brand-600 dark:group-hover:text-emerald-400 transition-colors">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">لا توجد أقسام حالياً</p>
          )}
        </div>

        {/* Featured Products Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">أحدث العروض والأسعار المحدثة</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">أسعار خاصة للشرائح بالكرتونة والشكارة</p>
            </div>
            <Link href="/products" className="text-brand-600 dark:text-emerald-400 text-xs sm:text-sm font-bold flex items-center gap-1 hover:underline">
              كل المنتجات <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand-600 dark:text-emerald-400 animate-spin" />
            </div>
          ) : safeProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {safeProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-3">
              <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">لم يتم تحميل المنتجات، يرجى إعادة المحاولة</p>
              <button
                onClick={loadPublicData}
                className="btn-accent text-xs font-bold px-5 py-2.5 rounded-xl shadow inline-flex items-center gap-2"
              >
                🔄 إعادة المحاولة
              </button>
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}