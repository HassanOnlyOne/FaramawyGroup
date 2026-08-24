import { PricingTier, Product, Profile } from './types';

export function calculateTieredPrice(
  basePriceOrProduct: number | Product,
  quantity: number,
  tiers?: PricingTier[]
): number {
  const basePrice = typeof basePriceOrProduct === 'number' ? basePriceOrProduct : basePriceOrProduct.base_price;
  const actualTiers = typeof basePriceOrProduct === 'number' ? tiers : (basePriceOrProduct.pricing_tiers || tiers);

  if (!actualTiers || actualTiers.length === 0) return basePrice;
  
  const sortedTiers = [...actualTiers].sort((a, b) => b.min_quantity - a.min_quantity);
  
  for (const tier of sortedTiers) {
    if (quantity >= tier.min_quantity) {
      if (!tier.max_quantity || quantity <= tier.max_quantity) {
        return tier.price_per_unit;
      }
    }
  }
  
  return basePrice;
}

export interface CreditValidationResult {
  allowed: boolean;
  availableCredit: number;
  currentBalance: number;
  creditLimit: number;
  message: string;
}

export function validateCreditOrder(
  orderTotal: number,
  customer: Profile
): CreditValidationResult {
  const currentBalance = customer.previous_balance || 0;
  const creditLimit = customer.credit_limit || 0;
  const availableCredit = creditLimit - currentBalance;
  const newBalance = currentBalance + orderTotal;
  const allowed = newBalance <= creditLimit;

  return {
    allowed,
    availableCredit,
    currentBalance,
    creditLimit,
    message: allowed
      ? `رصيد متاح: ${availableCredit.toFixed(2)} ج.م`
      : `تجاوز الحد الائتماني! المتاح: ${availableCredit.toFixed(2)} ج.م — المطلوب: ${orderTotal.toFixed(2)} ج.م`,
  };
}
