-- =============================================
-- Migration 010: Ensure stock_deducted column on orders
-- =============================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN DEFAULT false;

-- Create index for fast status and stock_deducted checks
CREATE INDEX IF NOT EXISTS idx_orders_stock_deducted ON orders(stock_deducted);
