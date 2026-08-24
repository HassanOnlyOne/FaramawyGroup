'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, Trash2, ShoppingBag, Banknote, CreditCard } from 'lucide-react';
import { useCart } from './cart-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import Link from 'next/link';

export function CartDrawer() {
  const { items, isOpen, toggleCart, updateQuantity, removeItem, paymentMethod, setPaymentMethod, total } = useCart();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={toggleCart} />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-full sm:w-[420px] bg-white border-r border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-brand-50">
          <h2 className="text-lg font-bold text-brand-800 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand-600" />
            سلة المشتريات
            <span className="text-sm font-normal text-slate-400">({items.length} صنف)</span>
          </h2>
          <button onClick={toggleCart} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ShoppingBag className="h-16 w-16 mb-4 opacity-20" />
              <p className="font-medium">السلة فارغة</p>
              <p className="text-sm mt-1">ابدأ بإضافة المنتجات من السوق</p>
            </div>
          ) : (
            items.map((item) => {
              const moq = item.product.min_order_quantity || 1;
              const isDiscounted = item.unit_price < item.product.base_price;
              return (
                <div key={item.product_id} className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 relative">
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{item.product.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{item.unit_price.toLocaleString('ar-EG')} ج.م / {item.product.wholesale_unit || item.product.unit}</span>
                          {isDiscounted && (
                            <Badge variant="success" size="sm">جملة</Badge>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.product_id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 h-8 px-0.5">
                        <button 
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="h-7 w-7 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-md"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-bold w-8 text-center text-slate-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="h-7 w-7 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-md"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-bold text-brand-700">{item.total_price.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
            {/* Payment Method Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                  paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'
                )}
              >
                <Banknote className="h-4 w-4" />
                كاش
              </button>
              <button
                onClick={() => setPaymentMethod('credit')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                  paymentMethod === 'credit' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-400'
                )}
              >
                <CreditCard className="h-4 w-4" />
                أجل
              </button>
            </div>
            
            <div className="flex items-center justify-between text-lg">
              <span className="font-medium text-slate-600">الإجمالي</span>
              <span className="font-black text-brand-700 text-xl">{total.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <Link href="/checkout" onClick={toggleCart}>
              <Button variant="primary" size="lg" className="w-full btn-accent text-base">
                إتمام الطلب
              </Button>
            </Link>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
