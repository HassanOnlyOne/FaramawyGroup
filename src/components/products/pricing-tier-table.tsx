import * as React from 'react';
import { PricingTier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface PricingTierTableProps {
  tiers: PricingTier[];
  basePrice: number;
  unit?: string;
  currentQuantity?: number;
}

export function PricingTierTable({ tiers, basePrice, currentQuantity = 0 }: PricingTierTableProps) {
  if (!tiers || tiers.length === 0) return null;

  const sortedTiers = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-navy-800 bg-navy-900/40" dir="rtl">
      <div className="bg-navy-800/50 px-4 py-3 border-b border-navy-700">
        <h4 className="font-semibold text-white">أسعار الجملة (الكميات)</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="text-xs uppercase text-navy-300 bg-navy-900/30">
            <tr>
              <th className="px-4 py-3 font-medium">الكمية</th>
              <th className="px-4 py-3 font-medium">سعر الوحدة</th>
              <th className="px-4 py-3 font-medium">التوفير</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-800/50">
            <tr className={cn(
              "transition-colors",
              currentQuantity > 0 && currentQuantity < sortedTiers[0].min_quantity ? "bg-emerald-500/10" : "hover:bg-navy-800/20"
            )}>
              <td className="px-4 py-3 text-white">1 - {sortedTiers[0].min_quantity - 1}</td>
              <td className="px-4 py-3 text-white font-medium">{basePrice} ج.م</td>
              <td className="px-4 py-3">-</td>
            </tr>
            {sortedTiers.map((tier, idx) => {
              const savings = Math.round(((basePrice - tier.price_per_unit) / basePrice) * 100);
              const isLast = idx === sortedTiers.length - 1;
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
                    isApplicable ? "bg-emerald-500/10" : "hover:bg-navy-800/20"
                  )}
                >
                  <td className="px-4 py-3 text-white font-medium">{range}</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold">{tier.price_per_unit} ج.م</td>
                  <td className="px-4 py-3">
                    <Badge variant="success" size="sm">
                      {savings}%
                    </Badge>
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
