'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { PricingTierTable } from '@/components/products/pricing-tier-table';
import { useCart } from '@/components/cart/cart-provider';
import { useToast } from '@/components/ui/toast';
import { Minus, Plus, ShoppingCart, ArrowRight, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { Product } from '@/lib/types';

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`);
        const data = await res.json();
        
        if (res.ok && data.data) {
          setProduct(data.data);
          // Set initial quantity based on tiers
          if (data.data.pricing_tiers && data.data.pricing_tiers.length > 0) {
             const minQ = Math.min(...data.data.pricing_tiers.map((t: any) => t.min_quantity));
             setQuantity(Math.max(1, minQ));
          }
        } else {
          toast({ title: 'خطأ', description: 'لم يتم العثور على المنتج', type: 'error' });
          router.push('/products');
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProduct();
  }, [id, router, toast]);

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        </div>
      </CustomerLayout>
    );
  }

  if (!product) return null;

  // Calculate current price based on quantity
  let currentPrice = product.base_price;
  if (product.pricing_tiers && product.pricing_tiers.length > 0) {
    const applicableTier = [...product.pricing_tiers]
      .sort((a, b) => b.min_quantity - a.min_quantity)
      .find(tier => quantity >= tier.min_quantity);
      
    if (applicableTier) {
      currentPrice = applicableTier.price_per_unit;
    }
  }

  const totalPrice = currentPrice * quantity;

  const handleAddToCart = () => {
    if (product.stock_quantity < quantity) {
      toast({
        title: 'عذراً',
        description: 'الكمية المطلوبة غير متوفرة في المخزون حالياً',
        type: 'error'
      });
      return;
    }

    addToCart(product, quantity);
    toast({
      title: 'تم الإضافة للسلة',
      description: `تم إضافة ${quantity} ${product.unit} من ${product.name}`,
      type: 'success'
    });
  };

  return (
    <CustomerLayout>
      <div className="py-8">
        <Link href="/products" className="inline-flex items-center gap-2 text-slate-500 hover:text-navy-900 mb-8 transition-colors">
          <ArrowRight className="w-4 h-4" />
          <span>العودة للمنتجات</span>
        </Link>

        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-12">
          
          {/* Image Gallery */}
          <div className="w-full lg:w-1/2">
            <div className="aspect-square bg-white rounded-2xl mb-4 overflow-hidden flex items-center justify-center border border-slate-200 p-4 shadow-sm">
               {(() => {
                 const rawImg = product.images && product.images[currentImageIndex];
                 const isInvalid = !rawImg || typeof rawImg !== 'string' || rawImg.includes('unsplash.com') || rawImg.trim() === '';

                 if (isInvalid) {
                   return (
                     <div className="w-full h-full rounded-2xl bg-gradient-to-br from-brand-50 via-slate-50 to-amber-50 flex flex-col items-center justify-center p-6 text-center border border-slate-100">
                       <div className="w-20 h-20 rounded-3xl bg-white shadow-md flex items-center justify-center mb-3 text-brand-600 font-bold text-3xl border border-slate-200">
                         ف
                       </div>
                       <h3 className="text-base font-bold text-slate-800 mb-1">{product.name}</h3>
                       <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                         الفرماوي جروب للتجارة والتوزيع
                       </span>
                     </div>
                   );
                 }

                 return (
                   <img 
                     src={rawImg} 
                     alt={product.name} 
                     className="w-full h-full object-contain p-4"
                   />
                 );
               })()}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-20 h-20 rounded-xl border-2 overflow-hidden shrink-0 ${
                      currentImageIndex === idx ? 'border-emerald-500' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <div className="mb-2 text-sm font-bold text-emerald-600 bg-emerald-50 inline-block px-3 py-1 rounded-full w-max">
              {product.category?.name}
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">{product.name}</h1>
            <p className="text-slate-500 mb-6 text-lg">{product.description}</p>
            
            <div className="mb-6 flex items-baseline gap-4">
              <span className="text-3xl font-bold text-emerald-600">
                {currentPrice} <span className="text-lg text-slate-500 font-normal">ج.م</span>
              </span>
              <span className="text-slate-500">/ {product.unit}</span>
            </div>

            {/* Pricing Tiers Table */}
            {product.pricing_tiers && product.pricing_tiers.length > 0 && (
              <div className="mb-8">
                <h3 className="font-bold text-navy-900 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-500" />
                  أسعار الجملة
                </h3>
                <PricingTierTable tiers={product.pricing_tiers} basePrice={product.base_price} unit={product.unit} />
              </div>
            )}

            {/* Stock Status */}
            <div className="mb-8">
              {product.stock_quantity > 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg w-max font-medium">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  متوفر ({product.stock_quantity} {product.unit})
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg w-max font-medium">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  غير متوفر
                </div>
              )}
            </div>

            {/* Add to Cart Actions */}
            <div className="mt-auto bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between mb-6">
                <div>
                  <label className="block text-sm font-bold text-navy-700 mb-2">الكمية المطلوبة ({product.unit})</label>
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden w-max">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-navy-900 transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input 
                      type="number" 
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-12 text-center font-bold text-navy-900 border-x border-slate-200 outline-none"
                    />
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-12 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-navy-900 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="text-left w-full sm:w-auto">
                  <div className="text-sm text-slate-500 mb-1">الإجمالي</div>
                  <div className="text-2xl font-bold text-navy-900">{totalPrice.toFixed(2)} ج.م</div>
                </div>
              </div>

              <button 
                onClick={handleAddToCart}
                disabled={product.stock_quantity === 0}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 text-lg"
              >
                <ShoppingCart className="w-6 h-6" />
                {product.stock_quantity === 0 ? 'نفذت الكمية' : 'إضافة إلى السلة'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
