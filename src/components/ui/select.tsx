import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 text-right" dir="rtl">
        {label && (
          <label className="block text-sm font-medium text-navy-100">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            className={cn(
              'appearance-none flex h-10 w-full rounded-xl border border-navy-700 bg-navy-900/50 px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 backdrop-blur-sm',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            ref={ref}
            {...props}
          >
            {placeholder && (
              <option value="" disabled selected hidden>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-navy-900 text-white">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
        {error && (
          <p className="text-xs mt-1 text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
