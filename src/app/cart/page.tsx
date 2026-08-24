'use client';

import { useCart } from '@/components/cart/cart-provider';
import { CustomerLayout } from '@/components/layout/customer-layout';
import Link from 'next/link';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNumberFormat } from '@/context/number-format-context';

export default function CartPage() {
  const { items, removeItem, updateQuantity, getCartTotal, clearCart } = useCart();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <CustomerLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-12 h-12 text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">سلة المشتريات فارغة</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">لم تقم بإضافة أي منتجات إلى سلة المشتريات بعد.</p>
          <Link 
            href="/products" 
            className="btn-primary py-3 px-8 rounded-xl font-bold transition-all shadow-md text-sm"
          >
            تصفح بضائع الجملة
          </Link>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="py-8 max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          سلة المشتريات والتوريدات
        </h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cart Items */}
          <div className="w-full lg:w-2/3">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="hidden sm:grid grid-cols-12 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
                <div className="col-span-6">المنتج</div>
                <div className="col-span-3 text-center">الكمية</div>
                <div className="col-span-2 text-left">الإجمالي</div>
                <div className="col-span-1 text-center"></div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <div key={item.product.id} className="py-6 flex flex-col sm:grid sm:grid-cols-12 gap-4 items-center">
                    
                    {/* Product Info */}
                    <div className="col-span-6 flex items-center gap-4 w-full">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-2xl flex-shrink-0 p-2 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                        {item.product.images?.[0] ? (
                          <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <Link href={`/products/${item.product.id}`} className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 transition-colors block mb-1">
                          {item.product.name}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-mono">
                          السعر: {formatPriceShort(item.appliedPrice)} / {item.product.wholesale_unit || item.product.unit || 'عبوة'}
                        </div>
                        {item.appliedPrice < item.product.base_price && (
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 inline-block">
                            سعر الجملة مطبق
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-3 flex justify-center w-full sm:w-auto">
                      <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <button 
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input 
                          type="number" 
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                          className="w-12 h-9 text-center font-bold text-slate-900 dark:text-white border-x border-slate-200 dark:border-slate-700 outline-none bg-transparent font-mono text-sm"
                        />
                        <button 
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="col-span-2 text-left font-black text-slate-900 dark:text-white text-base font-mono w-full sm:w-auto flex justify-between sm:block">
                      <span className="sm:hidden text-xs text-slate-500">الإجمالي:</span>
                      {formatPriceShort(item.appliedPrice * item.quantity)}
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 text-center w-full sm:w-auto flex justify-end sm:justify-center">
                      <button 
                        onClick={() => removeItem(item.product.id)}
                        className="text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <button 
                  onClick={clearCart}
                  className="text-xs text-red-600 dark:text-red-400 font-bold hover:underline"
                >
                  إفراغ سلة المشتريات
                </button>
                <Link href="/products" className="text-xs font-bold text-brand-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                  إضافة المزيد من البضائع <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-1/3">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 sticky top-24 space-y-6">
              <h3 className="text-lg font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">
                ملخص طلب التوريد
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>عدد الأصناف:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{formatNumber(items.length)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>إجمالي الكمية:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{formatNumber(items.reduce((acc, i) => acc + i.quantity, 0))} عبوة</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>تكلفة الشحن والتوصيل:</span>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                    يُحدد لاحقاً (حسب المسافة والكمية)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
                  ℹ️ يتم تحديد وتأكيد مصاريف التوصيل الفعلية عند مراجعة الطلب وتأكيده هاتفياً من إدارة التوزيع.
                </p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                  <span className="font-black text-slate-900 dark:text-white text-base">إجمالي بضائع الفاتورة:</span>
                  <span className="text-2xl font-black text-brand-700 dark:text-emerald-400 font-mono">
                    {formatPriceShort(getCartTotal())}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => router.push('/checkout')}
                className="w-full btn-primary py-3.5 rounded-xl font-black text-center shadow-lg transition-all text-sm block"
              >
                متابعة وإتمام الفاتورة
              </button>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
