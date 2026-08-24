import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-navy-700 bg-navy-900/20 backdrop-blur-sm h-full min-h-[300px]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-800/50 mb-6">
        <Icon className="h-10 w-10 text-navy-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-navy-300 max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  );
}
