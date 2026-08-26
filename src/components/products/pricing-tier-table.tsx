'use client';

import * as React from 'react';
import { PricingTier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tag } from 'lucide-react';

export interface PricingTierTableProps {
  tiers: PricingTier[];
  basePrice: number;
  unit?: string;
  currentQuantity?: number;
}

export function PricingTierTable({ tiers, basePrice, unit = 'عبوة', currentQuantity = 0 }: PricingTierTableProps) {
  if (!tiers || tiers.length === 0) return null;

  const sortedTiers = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 shadow-sm" dir="rtl">
      <div className="bg-slate-100 dark:bg-slate-900/60 px-4 py-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
        <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-500" />
          <span>شرائح أسعار الجملة حسب الكمية</span>
        </h4>
        <span className="text-[11px] text-slate-400 font-medium">الوحدة: {unit}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-right">
          <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700/60">
            <tr>
              <th className="px-4 py-2.5 font-bold">الكمية ({unit})</th>
              <th className="px-4 py-2.5 font-bold">سعر الوحدة</th>
              <th className="px-4 py-2.5 font-bold text-center">نسبة التوفير</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {/* Base Tier */}
            <tr className={cn(
              "transition-colors",
              currentQuantity > 0 && currentQuantity < sortedTiers[0].min_quantity 
                ? "bg-emerald-500/15 dark:bg-emerald-950/40 font-bold" 
                : "hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
            )}>
              <td className="px-4 py-3 text-slate-900 dark:text-white font-mono font-medium">
                1 {sortedTiers[0].min_quantity > 2 ? `- ${sortedTiers[0].min_quantity - 1}` : ''}
              </td>
              <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-bold font-mono">
                {basePrice.toLocaleString('ar-EG')} ج.م
              </td>
              <td className="px-4 py-3 text-center text-slate-400 font-mono">-</td>
            </tr>

            {/* Discounted Tiers */}
            {sortedTiers.map((tier) => {
              const diff = basePrice - tier.price_per_unit;
              const savings = basePrice > 0 ? Math.round((diff / basePrice) * 100) : 0;
              const range = tier.max_quantity 
                ? `${tier.min_quantity} - ${tier.max_quantity}` 
                : `${tier.min_quantity} فأكثر`;
              
              const isApplicable = currentQuantity >= tier.min_quantity && 
                (!tier.max_quantity || currentQuantity <= tier.max_quantity);

              return (
                <tr 
                  key={tier.id} 
                  className={cn(
                    "transition-colors",
                    isApplicable 
                      ? "bg-emerald-500/15 dark:bg-emerald-950/40 font-bold" 
                      : "hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                  )}
                >
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-mono font-medium">
                    {range}
                  </td>
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold font-mono text-sm sm:text-base">
                    {tier.price_per_unit.toLocaleString('ar-EG')} ج.م
                  </td>
                  <td className="px-4 py-3 text-center">
                    {savings > 0 ? (
                      <span className="inline-flex items-center justify-center font-bold font-mono px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs shadow-xs">
                        خصم {savings}%
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
