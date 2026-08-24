'use client';

import { CartProvider } from '@/components/cart/cart-provider';
import { ToastProvider } from '@/components/ui/toast';
import { NumberFormatProvider } from '@/context/number-format-context';
import { ThemeProvider } from '@/context/theme-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NumberFormatProvider>
        <ToastProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </ToastProvider>
      </NumberFormatProvider>
    </ThemeProvider>
  );
}
