import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export function Card({ className, children, header, footer, noPadding = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-navy-800 bg-navy-900/40 backdrop-blur-md shadow-xl overflow-hidden',
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-navy-800 bg-navy-900/50">
          {header}
        </div>
      )}
      <div className={cn(!noPadding && 'p-6')}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-navy-800 bg-navy-900/50">
          {footer}
        </div>
      )}
    </div>
  );
}
