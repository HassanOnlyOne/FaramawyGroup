import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'card' | 'table-row' | 'product-card';
}

export function Skeleton({ className, variant = 'text', ...props }: SkeletonProps) {
  if (variant === 'product-card') {
    return (
      <div className={cn("rounded-2xl border border-navy-800 bg-navy-900/40 p-4 space-y-4 animate-pulse", className)} {...props}>
        <div className="w-full h-40 bg-navy-800/50 rounded-xl" />
        <div className="space-y-2">
          <div className="h-4 bg-navy-800/50 rounded w-3/4" />
          <div className="h-3 bg-navy-800/50 rounded w-1/2" />
        </div>
        <div className="pt-4 flex justify-between items-center border-t border-navy-800/50">
          <div className="h-6 bg-navy-800/50 rounded w-1/4" />
          <div className="h-8 bg-navy-800/50 rounded-xl w-1/3" />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn("rounded-2xl border border-navy-800 bg-navy-900/40 p-6 space-y-4 animate-pulse", className)} {...props}>
        <div className="h-6 bg-navy-800/50 rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-4 bg-navy-800/50 rounded w-full" />
          <div className="h-4 bg-navy-800/50 rounded w-5/6" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("animate-pulse bg-navy-800/50 rounded", variant === 'text' && "h-4", className)}
      {...props}
    />
  );
}
