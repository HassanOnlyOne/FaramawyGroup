'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { PricingTierTable } from '@/components/products/pricing-tier-table';
import { useCart } from '@/components/cart/cart-provider';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { calculateTieredPrice } from '@/lib/pricing';
import { Product } from '@/lib/types';
import { 
  Minus, 
  Plus, 
  ShoppingCart, 
  ArrowRight, 
  Loader2, 
  Package, 
  Tag, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Pause
} from 'lucide-react';

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem, addToCart } = useCart();
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}?t=${Date.now()}`);
        const data = await res.json();
        
        if (res.ok && (data.data || data.product)) {
          const prod: Product = data.data || data.product;
          setProduct(prod);
          const moq = prod.min_order_quantity || 1;
          setQuantity(moq);
        } else {
          toast({ title: 'خطأ', description: 'لم يتم العثور على المنتج المطلوب', type: 'error' });
          router.push('/products');
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id, router, toast]);

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="flex flex-col justify-center items-center h-[60vh] gap-3">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل بيانات الصنف...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (!product) return null;

  const isPaused = Boolean(product.is_paused);
  const minOrderQty = product.min_order_quantity || 1;
  const isOutOfStock = product.stock_quantity <= 0;
  const maxAvailable = Math.max(0, product.stock_quantity || 0);

  // Accurate tiered price based on current quantity
  const currentPrice = calculateTieredPrice(product.base_price, quantity, product.pricing_tiers);
  const totalPrice = currentPrice * quantity;
  const unitLabel = product.wholesale_unit || product.unit || 'كرتونة';

  const handleAddToCart = () => {
    if (isPaused) {
      toast({
        title: 'تنبيه',
        description: 'هذا الصنف متوقف مؤقتاً عن استقبال الطلبات حالياً',
        type: 'warning'
      });
      return;
    }

    if (isOutOfStock) {
      toast({
        title: 'عذراً',
        description: 'هذا الصنف نفد من المخزون حالياً',
        type: 'error'
      });
      return;
    }

    if (quantity > maxAvailable) {
      toast({
        title: 'الحد الأقصى للمخزون',
        description: `الحد الأقصى المتاح في المخزن هو ${formatNumber(maxAvailable)} ${unitLabel}`,
        type: 'warning'
      });
      setQuantity(maxAvailable);
      return;
    }

    // Support both addItem and addToCart
    if (typeof addItem === 'function') {
      addItem(product, quantity);
    } else if (typeof addToCart === 'function') {
      addToCart(product, quantity);
    }

    toast({
      title: 'تمت الإضافة إلى السلة بنجاح',
      description: `${formatNumber(quantity)} ${unitLabel} من (${product.name})`,
      type: 'success'
    });
  };

  const handleQuantityChange = (val: number) => {
    if (isPaused || isOutOfStock) return;
    const safeMin = Math.max(minOrderQty, 1);
    if (val > maxAvailable) {
      toast({
        title: 'الحد الأقصى للمخزون',
        description: `الحد الأقصى المتاح في المخزن هو ${formatNumber(maxAvailable)} ${unitLabel}`,
        type: 'warning'
      });
      setQuantity(maxAvailable);
      return;
    }
    const updated = Math.max(safeMin, val);
    setQuantity(updated);
  };

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link 
            href="/products" 
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة الأصناف</span>
          </Link>

          {product.sku_code && (
            <span className="text-xs font-mono font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 px-3 py-1 rounded-xl border border-brand-200 dark:border-brand-800">
              كود الصنف: {formatNumber(product.sku_code)}
            </span>
          )}
        </div>

        {/* Main Product Card */}
        <div className="bg-white dark:bg-[#0B132B] rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* Right/Top: Product Image Gallery */}
          <div className="w-full lg:w-1/2 flex flex-col gap-4">
            <div className="aspect-square w-full bg-slate-50 dark:bg-slate-900/80 rounded-3xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800 p-6 shadow-inner relative group">
              {(() => {
                const rawImg = product.images && product.images[currentImageIndex];
                const isInvalid = !rawImg || typeof rawImg !== 'string' || rawImg.includes('unsplash.com') || rawImg.trim() === '';

                if (isInvalid) {
                  return (
                    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-slate-100 via-slate-50 to-brand-50 dark:from-slate-900 dark:via-slate-850 dark:to-brand-950 flex flex-col items-center justify-center p-6 text-center border border-slate-200 dark:border-slate-800/80 shadow-xs">
                      <div className="w-24 h-24 rounded-3xl gradient-primary shadow-lg flex items-center justify-center mb-4 text-white font-black text-4xl">
                        ف
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-1 line-clamp-2">{product.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-950/60 px-3.5 py-1.5 rounded-full border border-accent-200 dark:border-accent-800/60 mt-2">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>الفرماوي جروب للتجارة والتوزيع</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <img 
                    src={rawImg} 
                    alt={product.name} 
                    className="w-full h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                  />
                );
              })()}

              {/* In-Stock / Out of Stock / Paused Floating Badge */}
              <div className="absolute top-4 right-4">
                {isPaused ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500 text-white shadow-md backdrop-blur-xs">
                    <Pause className="w-3.5 h-3.5 fill-white" />
                    متوقف مؤقتاً
                  </span>
                ) : isOutOfStock ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-red-500/90 text-white shadow-md backdrop-blur-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    نفد المخزون
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600/90 text-white shadow-md backdrop-blur-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    متوفر للتوريد
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail selector if multiple images exist */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-20 h-20 rounded-2xl border-2 overflow-hidden shrink-0 bg-slate-50 dark:bg-slate-900 p-1.5 transition-all ${
                      currentImageIndex === idx 
                        ? 'border-brand-500 ring-2 ring-brand-500/30' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Left/Bottom: Product Details & Purchase Card */}
          <div className="w-full lg:w-1/2 flex flex-col justify-between space-y-6">
            
            <div className="space-y-4">
              {/* Badges Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {product.category?.name && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-3 py-1 rounded-xl border border-brand-200 dark:border-brand-800">
                    <Tag className="w-3.5 h-3.5 text-brand-500" />
                    {product.category.name}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  الوحدة: {unitLabel}
                </span>

                {minOrderQty > 1 && (
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-800">
                    أقل كمية طلب: {formatNumber(minOrderQty)} {unitLabel}
                  </span>
                )}
              </div>
              
              {/* Title & Description */}
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white leading-snug tracking-tight">
                  {product.name}
                </h1>
                {product.description && (
                  <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mt-2.5">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Price Display */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                    سعر الجملة للوحدة:
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                      {formatPriceShort(currentPrice)}
                    </span>
                    <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                      / {unitLabel}
                    </span>
                  </div>
                </div>

                {currentPrice < product.base_price && (
                  <div className="text-left">
                    <span className="text-xs text-slate-400 line-through font-mono block">
                      {formatPriceShort(product.base_price)}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      تم تطبيق خصم شريحة الجملة
                    </span>
                  </div>
                )}
              </div>

              {/* Stock Status Badge & Paused Alert */}
              <div className="space-y-2">
                {isPaused ? (
                  <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm inline-flex items-center gap-2.5 shadow-xs">
                    <Pause className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span>هذا الصنف متوقف مؤقتاً عن استقبال طلبات جديدة حالياً</span>
                  </div>
                ) : !isOutOfStock ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm inline-flex items-center gap-2.5 shadow-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span>المتوفر في المخزن: {formatNumber(product.stock_quantity)} {unitLabel}</span>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm inline-flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>نفد المخزون حالياً</span>
                  </div>
                )}
              </div>

              {/* Pricing Tiers Table */}
              {product.pricing_tiers && product.pricing_tiers.length > 0 && (
                <div className="pt-2">
                  <PricingTierTable 
                    tiers={product.pricing_tiers} 
                    basePrice={product.base_price} 
                    unit={unitLabel}
                    currentQuantity={quantity}
                  />
                </div>
              )}
            </div>

            {/* Purchase & Add to Cart Card */}
            <div className="mt-auto bg-slate-50 dark:bg-slate-900/90 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    الكمية المطلوبة ({unitLabel})
                  </label>
                  <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                    <button 
                      type="button"
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= minOrderQty || isOutOfStock || isPaused}
                      className="w-12 h-12 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors font-bold text-lg"
                      title="تقليل الكمية"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input 
                      type="number" 
                      min={minOrderQty}
                      max={maxAvailable || 9999}
                      value={quantity}
                      disabled={isOutOfStock || isPaused}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || minOrderQty)}
                      className="w-16 h-12 text-center font-bold text-base font-mono bg-transparent text-slate-900 dark:text-white border-x border-slate-200 dark:border-slate-700 outline-none disabled:opacity-50"
                    />
                    <button 
                      type="button"
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={isOutOfStock || isPaused || (product.stock_quantity > 0 && quantity >= product.stock_quantity)}
                      className="w-12 h-12 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors font-bold text-lg"
                      title="زيادة الكمية"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="text-left w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-0.5">الإجمالي الفوري:</span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {formatPriceShort(totalPrice)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    ({formatNumber(quantity)} × {formatPriceShort(currentPrice)})
                  </div>
                </div>
              </div>

              {/* Add to Cart Button */}
              {isPaused ? (
                <button 
                  type="button"
                  disabled
                  className="w-full bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-base sm:text-lg cursor-not-allowed"
                >
                  <Pause className="w-5 h-5 fill-amber-500 text-amber-500" />
                  <span>غير متاح للطلب حالياً (متوقف مؤقتاً)</span>
                </button>
              ) : isOutOfStock ? (
                <button 
                  type="button"
                  disabled
                  className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-base sm:text-lg cursor-not-allowed"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span>نفد المخزون حالياً</span>
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full bg-gradient-to-l from-brand-700 via-brand-600 to-brand-700 hover:from-brand-800 hover:to-brand-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-brand-600/30 flex items-center justify-center gap-3 text-base sm:text-lg transition-all active:scale-[0.99] cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>إضافة إلى السلة — {formatPriceShort(totalPrice)}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
