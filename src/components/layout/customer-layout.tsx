'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/components/cart/cart-provider';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { BRAND } from '@/lib/constants';
import { Store, Package, ShoppingCart, ClipboardList, Receipt, UserCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NumberFormatToggle } from '@/components/ui/number-format-toggle';

const BOTTOM_TABS = [
  { href: '/', label: 'السوق', icon: Store, match: (p: string) => p === '/' },
  { href: '/products', label: 'المنتجات', icon: Package, match: (p: string) => p === '/products' || (p.startsWith('/products/') && !p.startsWith('/products/new')) },
  { href: '/cart', label: 'السلة', icon: ShoppingCart, match: (p: string) => p === '/cart' || p === '/checkout' },
  { href: '/orders', label: 'طلباتي', icon: ClipboardList, match: (p: string) => p === '/orders' || p.startsWith('/orders/') },
  { href: '/credit', label: 'الأجل', icon: Receipt, match: (p: string) => p === '/credit' },
  { href: '/account', label: 'الحساب', icon: UserCircle, match: (p: string) => p === '/account' },
];

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { items } = useCart();
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-24 transition-colors duration-200" dir="rtl">
      {/* Top Contact Strip */}
      <div className="bg-brand-900 dark:bg-slate-900 text-white text-[11px] sm:text-xs py-1.5 px-3 sm:px-4 flex items-center justify-center gap-3 sm:gap-4 flex-wrap border-b border-brand-800/50">
        <div className="flex items-center gap-1 text-emerald-400">
          <Phone className="h-3 w-3" />
          <span className="font-bold">للتواصل المباشر:</span>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap justify-center">
          {BRAND.contacts.map((num) => (
            <a key={num} href={`tel:${num}`} className="hover:text-emerald-300 transition-colors font-mono font-bold tracking-wide">
              {num}
            </a>
          ))}
        </div>
      </div>
      
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-md shadow-brand-700/20 shrink-0">
              ف
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-brand-900 dark:text-slate-100 leading-tight truncate">{BRAND.shortName}</h1>
              <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-tight truncate">للتجارة والتوزيع بالجملة</p>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <NumberFormatToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="bottom-nav dark:bg-slate-900/95 dark:border-slate-800 shadow-[0_-4px_25px_rgba(0,0,0,0.06)]" dir="rtl">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
          {BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.match(pathname);
            const isCart = tab.href === '/cart';
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center py-1 px-1 flex-1 text-center transition-all duration-200 relative min-w-[50px]',
                  isActive ? 'text-brand-700 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                )}
              >
                <div className="relative mb-0.5">
                  <Icon className={cn('h-5 w-5 sm:h-5.5 sm:w-5.5 transition-transform duration-200', isActive && 'scale-110')} />
                  {isCart && cartItemCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 h-4 min-w-[16px] px-1 rounded-full bg-accent-600 text-white text-[9px] font-black flex items-center justify-center shadow-md">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] tracking-tight leading-none whitespace-nowrap">
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-brand-700 dark:bg-emerald-400 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Cart Drawer */}
      <CartDrawer />
    </div>
  );
}
