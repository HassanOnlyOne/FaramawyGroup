'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'بحث...', className }: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  return (
    <div className={cn("relative w-full max-w-md", className)} dir="rtl">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400">
        <Search className="h-5 w-5" />
      </div>
      <input
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-navy-700 bg-navy-900/60 pl-10 pr-11 text-sm text-white placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300 backdrop-blur-md shadow-inner"
      />
      {localValue && (
        <button
          onClick={() => setLocalValue('')}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
