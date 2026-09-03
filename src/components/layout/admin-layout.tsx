'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/constants';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  LogOut, 
  Menu, 
  Bell,
  FolderTree,
  Warehouse,
  Banknote,
  Phone,
  Truck,
  UserCheck,
  Receipt,
  CreditCard,
  BarChart3,
  KeyRound,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NumberFormatToggle } from '@/components/ui/number-format-toggle';

const NAV_GROUPS = [
  {
    title: '📊 اللوحة الرئيسية',
    items: [
      { href: '/admin', label: 'لوحة التحكم والمؤشرات', icon: LayoutDashboard },
    ]
  },
  {
    title: '🛒 الحركة التجارية',
    items: [
      { href: '/admin/orders', label: 'طلبات المبيعات', icon: ShoppingCart },
      { href: '/admin/purchases', label: 'فواتير المشتريات', icon: Receipt },
    ]
  },
  {
    title: '📦 إدارة المخزون والأصناف',
    items: [
      { href: '/admin/products', label: 'المنتجات والأصناف', icon: Package },
      { href: '/admin/categories', label: 'الأقسام والوحدات', icon: FolderTree },
      { href: '/admin/inventory', label: 'الجرد والتحويلات', icon: Warehouse },
    ]
  },
  {
    title: '👥 العلاقات والشركاء',
    items: [
      { href: '/admin/customers', label: 'إدارة العملاء والأجل', icon: Users },
      { href: '/admin/suppliers', label: 'دليل الموردين', icon: Truck },
      { href: '/admin/delegates', label: 'المندوبين والمشرفين', icon: UserCheck },
      { href: '/admin/users-permissions', label: 'إدارة الفريق والصلاحيات', icon: KeyRound },
    ]
  },
  {
    title: '💰 الإدارة المالية والخزينة',
    items: [
      { href: '/admin/treasury', label: 'حركة الخزينة والسيولة', icon: CreditCard },
      { href: '/admin/expenses', label: 'المصروفات التشغيلية', icon: CreditCard },
    ]
  },
  {
    title: '📈 التقارير والتحليلات',
    items: [
      { href: '/admin/reports', label: 'مركز التقارير المالي', icon: BarChart3 },
      { href: '/admin/reports/statement', label: 'كشوف الحسابات والربحية', icon: Receipt },
      { href: '/admin/logs', label: 'سجل حركات النظام (Audit Log)', icon: History },
    ]
  }
];

import { createClient } from '@/lib/supabase/client';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [currentProfile, setCurrentProfile] = React.useState<any>(null);

  React.useEffect(() => {
    async function loadAdminUser() {
      try {
        const res = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const p = json.profile || json.user || json.data;
          if (p) setCurrentProfile(p);
        }
      } catch (err) {
        console.error('Failed to load admin profile', err);
      }
    }
    loadAdminUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      const supabase = createClient();
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200" dir="rtl">
      {/* Top Contact Strip */}
      <div className="bg-brand-950 dark:bg-slate-900 text-white text-xs py-1.5 px-4 flex items-center justify-center gap-4 no-print border-b border-brand-800/40">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Phone className="h-3 w-3" />
          <span className="font-bold">للتواصل المباشر:</span>
        </div>
        {BRAND.contacts.map((num) => (
          <a key={num} href={`tel:${num}`} className="hover:text-emerald-300 transition-colors font-mono font-bold tracking-wide">{num}</a>
        ))}
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 right-0 z-50 h-screen w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white font-black text-lg shadow-md shadow-brand-700/20">
              ف
            </div>
            <div>
              <h1 className="text-sm font-black text-brand-900 dark:text-white leading-tight">{BRAND.shortName}</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">نظام ERP وإدارة التوريدات</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="text-lg font-bold">✕</span>
          </button>
        </div>
        <div className="h-1 bg-gradient-to-l from-brand-600 to-accent-500 w-full shrink-0"></div>

        <nav className="p-3 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 px-3 tracking-wide">{group.title}</h3>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 group text-xs font-bold",
                      isActive 
                        ? "bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-emerald-400 font-bold border border-brand-200 dark:border-brand-800 shadow-sm" 
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-600 dark:text-emerald-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-1">
          <Link href="/" className="w-full justify-start text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold p-2 rounded-xl flex items-center gap-2 transition-colors">
            <span>🏪</span>
            <span>الذهاب لسوق الجملة</span>
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full justify-start text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold p-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pr-64 min-h-screen flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 no-print transition-colors duration-200">
          <div className="flex items-center gap-4 lg:hidden">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Menu className="h-6 w-6" />
            </button>
          </div>
          
          <div className="flex items-center gap-3 mr-auto">
            <NumberFormatToggle />
            <ThemeToggle />
            <div className="flex items-center gap-3 border-r border-slate-200 dark:border-slate-800 pr-3">
              <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center text-white font-black text-sm shadow">
                {(currentProfile?.full_name || currentProfile?.store_name || 'أ').trim().charAt(0)}
              </div>
              <div className="hidden sm:block text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-100 max-w-[150px] truncate">
                  {currentProfile?.full_name || currentProfile?.store_name || 'المدير العام'}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {currentProfile?.role === 'super_owner' 
                    ? 'مالك النظام' 
                    : (currentProfile?.role === 'admin' ? 'المدير العام' : (currentProfile?.role === 'delegate' ? 'مندوب مبيعات' : 'فريق العمل'))}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
