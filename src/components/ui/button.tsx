import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, icon, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20 border border-transparent',
      secondary: 'bg-navy-600 text-white hover:bg-navy-500 shadow-sm border border-transparent',
      danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm border border-transparent',
      ghost: 'bg-transparent text-navy-200 hover:text-white hover:bg-navy-800',
      outline: 'bg-transparent text-emerald-500 border border-emerald-500 hover:bg-emerald-500/10',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2 text-sm',
      lg: 'h-12 px-8 text-base font-medium',
    };

    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        {!loading && icon && <span className="ml-2">{icon}</span>}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
