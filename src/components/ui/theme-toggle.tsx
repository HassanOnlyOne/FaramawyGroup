'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/theme-context';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="تبديل الوضع الليلي / النهاري"
      title={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
      className={`relative p-2 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm active:scale-95 ${
        isDark 
          ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700' 
          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 transition-transform duration-300 rotate-0 scale-100" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-300 rotate-0 scale-100" />
      )}
    </button>
  );
}
