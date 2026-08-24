import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { OrderStatus } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status] || status;
  // Fallback to default if not found
  const colorVariant = ORDER_STATUS_COLORS[status] || 'default';
  
  // Map our constant color names to badge variants if they differ
  // Ensure that out_for_delivery falls back gracefully if it uses 'default' but wants primary feel
  const badgeVariant = colorVariant === 'default' && status === 'out_for_delivery' ? 'info' : colorVariant;

  return (
    <Badge variant={badgeVariant as any} size={size}>
      {label}
    </Badge>
  );
}
