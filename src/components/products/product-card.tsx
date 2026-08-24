'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Tag, Package, AlertCircle } from 'lucide-react';
import { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/components/cart/cart-provider';
import { calculateTieredPrice } from '@/lib/pricing';
import { useNumberFormat } from '@/context/number-format-context';
import { cn } from '@/lib/utils';

export interface ProductCardProps {
  product: Product;
}

export class ProductCardErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackName?: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ProductCard render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center text-slate-500 space-y-2 shadow-sm" dir="rtl">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{this.props.fallbackName || 'منتج جملة'}</p>
          <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">الفرماوي جروب</span>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProductCardInner({ product }: ProductCardProps) {
  const safeProduct = product || ({} as Product);
  const { addItem } = useCart();
  const { formatPriceShort, formatNumber } = useNumberFormat();

  const moq = Math.max(1, Number(safeProduct?.min_order_quantity || 1));
  const [quantity, setQuantity] = React.useState(moq);

  const tiers = Array.isArray(safeProduct?.pricing_tiers) ? safeProduct.pricing_tiers : [];
  const hasTiers = tiers.length > 0;
  const basePrice = Number(safeProduct?.base_price || (safeProduct as any)?.price || 0);

  const rawCurrentPrice = calculateTieredPrice(basePrice, quantity, tiers);
  const currentPrice = Number(rawCurrentPrice || basePrice || 0);
  const isDiscounted = currentPrice < basePrice;

  let maxDiscount = 0;
  if (hasTiers && basePrice > 0) {
    const minPrice = Math.min(...tiers.map(t => Number(t.price_per_unit || basePrice)));
    maxDiscount = Math.round(((basePrice - minPrice) / basePrice) * 100);
  }

  const stockQty = Number(safeProduct?.stock_quantity ?? 100);
  const isOutOfStock = stockQty <= 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(safeProduct, quantity);
    setQuantity(moq);
  };

  const imagesList = Array.isArray(safeProduct?.images) ? safeProduct.images : [];
  const rawImg = imagesList[0] || (safeProduct as any)?.image || (safeProduct as any)?.image_url || '';
  const isInvalidImg = !rawImg || typeof rawImg !== 'string' || rawImg.includes('unsplash.com') || rawImg.trim() === '';

  const productName = safeProduct?.name || 'منتج غير محدد';
  const unitLabel = safeProduct?.wholesale_unit || safeProduct?.unit || 'عبوة';

  return (
    <div
      className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-brand-300 dark:hover:border-emerald-500 hover:scale-[1.01]"
      dir="rtl"
      suppressHydrationWarning
    >
      {/* Top Bar: SKU + Category */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {safeProduct?.sku_code && (
            <span className="text-[10px] font-mono bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-md font-bold">
              SKU: {formatNumber(safeProduct.sku_code)}
            </span>
          )}
          {safeProduct?.category?.name && (
            <span className="text-[10px] text-slate-400 dark:text-slate-400">{safeProduct.category.name}</span>
          )}
        </div>
        {isOutOfStock && (
          <Badge variant="error" size="sm">نفد المخزون</Badge>
        )}
      </div>

      {/* Product Image Container */}
      <Link href={`/products/${safeProduct?.id || ''}`} className="relative w-full h-44 bg-white dark:bg-slate-900 flex items-center justify-center p-3 border-b border-slate-100 dark:border-slate-800 overflow-hidden group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 transition-colors">
        {isInvalidImg ? (
          <div className="w-full h-full rounded-xl bg-gradient-to-br from-brand-50 via-slate-50 to-amber-50/40 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 flex flex-col items-center justify-center p-2 text-center border border-slate-100 dark:border-slate-800 relative group-hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-2 border border-slate-200/60 dark:border-slate-700 text-brand-600 dark:text-emerald-400">
              <Package className="h-6 w-6 text-brand-600 dark:text-emerald-400" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 max-w-[140px] line-clamp-1 leading-tight">{productName}</span>
            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800 mt-1">الفرماوي جروب</span>
          </div>
        ) : (
          <img 
            src={rawImg}
            alt={productName}
            className="h-full max-w-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLElement;
              target.style.display = 'none';
            }}
          />
        )}
      </Link>

      {/* Product Info */}
      <Link href={`/products/${safeProduct?.id || ''}`} className="flex flex-col flex-1 p-4">
        {/* Product Name */}
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2 line-clamp-2 leading-relaxed">
          {productName}
        </h3>

        {/* Pricing Area */}
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-brand-900 dark:text-emerald-400 font-mono">
                {formatPriceShort(currentPrice)}
              </span>
              <span className="text-xs text-slate-400 font-medium">/{unitLabel}</span>
            </div>
            {isDiscounted && (
              <span className="text-xs text-slate-400 line-through font-mono">
                {formatPriceShort(basePrice)}
              </span>
            )}
          </div>

          {maxDiscount > 0 && (
            <span className="text-[11px] font-black bg-accent-100 text-accent-700 dark:bg-accent-950 dark:text-accent-300 px-2 py-0.5 rounded-lg border border-accent-200 dark:border-accent-800">
              وفر حتى {formatNumber(maxDiscount)}%
            </span>
          )}
        </div>
      </Link>

      {/* Action Footer */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        {/* Quantity Controls */}
        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQuantity(Math.max(moq, quantity - 1));
            }}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center font-bold text-xs font-mono text-slate-800 dark:text-slate-200">
            {formatNumber(quantity)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQuantity(quantity + 1);
            }}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add Button */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className="flex-1 btn-primary py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>إضافة للسلة</span>
        </button>
      </div>
    </div>
  );
}

export function ProductCard(props: ProductCardProps) {
  return (
    <ProductCardErrorBoundary fallbackName={props?.product?.name}>
      <ProductCardInner {...props} />
    </ProductCardErrorBoundary>
  );
}
