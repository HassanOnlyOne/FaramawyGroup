'use client';

import * as React from 'react';
import { useNumberFormat } from '@/context/number-format-context';
import { Languages } from 'lucide-react';

export function NumberFormatToggle({ className = '' }: { className?: string }) {
  const { numberFormat, toggleNumberFormat } = useNumberFormat();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${className}`} />
    );
  }

  const isArabicDigits = numberFormat === 'ar';

  return (
    <button
      type="button"
      onClick={toggleNumberFormat}
      aria-label="تبديل لغة الأرقام (123 ⇋ ١٢٣)"
      title={isArabicDigits ? 'التبديل إلى الأرقام الإنجليزية (123)' : 'التبديل إلى الأرقام العربية (١٢٣)'}
      className={`relative px-2.5 py-1.5 rounded-xl border font-mono font-bold text-xs transition-all duration-200 flex items-center gap-1.5 shadow-sm active:scale-95 ${
        isArabicDigits
          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
          : 'bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-200'
      } ${className}`}
    >
      <Languages className="w-3.5 h-3.5 opacity-70" />
      <span className="font-black text-sm tracking-wider">
        {isArabicDigits ? '١٢٣' : '123'}
      </span>
    </button>
  );
}
