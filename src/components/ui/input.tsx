import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, helperText, type, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 text-right" dir="rtl">
        {label && (
          <label className="block text-sm font-medium text-navy-100">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-xl border border-navy-700 bg-navy-900/50 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 backdrop-blur-sm',
              icon && 'pl-3 pr-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            ref={ref}
            {...props}
          />
          {icon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400">
              {icon}
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p className={cn('text-xs mt-1', error ? 'text-red-500' : 'text-navy-300')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
