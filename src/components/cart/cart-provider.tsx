'use client';

import * as React from 'react';
import { Product, OrderItem, PaymentMethod } from '@/lib/types';
import { calculateTieredPrice } from '@/lib/pricing';

export interface CartItem extends OrderItem {
  product: Product;
  appliedPrice: number;
}

export interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  addItem: (product: Product, quantity: number) => void;
  addToCart: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  getCartTotal: () => number;
  subtotal: number;
  total: number;
}

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('cash');

  React.useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('elfarmawy_cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed.map((item: any) => ({
          ...item,
          appliedPrice: item.appliedPrice ?? item.unit_price
        })));
      } catch (e) {
        console.error('Failed to parse cart');
      }
    }
    const savedPayment = localStorage.getItem('elfarmawy_payment_method');
    if (savedPayment === 'cash' || savedPayment === 'credit') {
      setPaymentMethod(savedPayment);
    }
  }, []);

  React.useEffect(() => {
    if (isMounted) {
      localStorage.setItem('elfarmawy_cart', JSON.stringify(items));
    }
  }, [items, isMounted]);

  React.useEffect(() => {
    if (isMounted) {
      localStorage.setItem('elfarmawy_payment_method', paymentMethod);
    }
  }, [paymentMethod, isMounted]);

  const addItem = React.useCallback((product: Product, quantity: number) => {
    if (product.is_paused) {
      alert(`عفواً، صنف (${product.name}) متوقف مؤقتاً عن الطلب حالياً`);
      return;
    }

    const maxStock = Math.max(0, Number(product.stock_quantity ?? 0));
    if (maxStock <= 0) {
      alert(`عفواً، صنف (${product.name}) نفد من المخزون حالياً`);
      return;
    }

    const moq = product.min_order_quantity || 1;
    const finalQty = Math.max(moq, quantity);
    
    setItems((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      let newQuantity = existing ? existing.quantity + finalQty : finalQty;
      
      if (newQuantity > maxStock) {
        newQuantity = maxStock;
        alert(`تم ضبط الكمية على الحد الأقصى المتاح في المخزن: ${maxStock} ${product.wholesale_unit || product.unit || 'كرتونة'}`);
      }

      const unitPrice = calculateTieredPrice(product.base_price, newQuantity, product.pricing_tiers);

      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: newQuantity, unit_price: unitPrice, appliedPrice: unitPrice, total_price: unitPrice * newQuantity }
            : item
        );
      }

      return [
        ...prev,
        {
          id: Math.random().toString(),
          order_id: '',
          product_id: product.id,
          quantity: newQuantity,
          unit_price: unitPrice,
          appliedPrice: unitPrice,
          total_price: unitPrice * newQuantity,
          product,
        },
      ];
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = React.useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      const item = prev.find(i => i.product_id === productId);
      if (!item) return prev;
      const moq = item.product.min_order_quantity || 1;
      if (quantity < moq) {
        return prev.filter((i) => i.product_id !== productId);
      }

      const maxStock = Math.max(0, Number(item.product.stock_quantity ?? 9999));
      let finalQuantity = quantity;
      if (finalQuantity > maxStock) {
        finalQuantity = maxStock;
        alert(`الحد الأقصى المتاح في المخزن هو ${maxStock} ${item.product.wholesale_unit || item.product.unit || 'كرتونة'}`);
      }

      return prev.map((i) => {
        if (i.product_id === productId) {
          const unitPrice = calculateTieredPrice(i.product.base_price, finalQuantity, i.product.pricing_tiers);
          return { ...i, quantity: finalQuantity, unit_price: unitPrice, appliedPrice: unitPrice, total_price: unitPrice * finalQuantity };
        }
        return i;
      });
    });
  }, []);

  const removeItem = React.useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  }, []);

  const clearCart = React.useCallback(() => { setItems([]); }, []);
  const toggleCart = React.useCallback(() => { setIsOpen((prev) => !prev); }, []);
  const getCartTotal = React.useCallback(() => items.reduce((sum, item) => sum + item.total_price, 0), [items]);
  const total = getCartTotal();

  return (
    <CartContext.Provider value={{ items, isOpen, paymentMethod, setPaymentMethod, addItem, addToCart: addItem, removeItem, updateQuantity, clearCart, toggleCart, getCartTotal, subtotal: total, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = React.useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
