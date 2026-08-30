-- =============================================
-- Migration 011: Atomic Procedures for Stock Operations
-- =============================================

-- 1. Atomic Order Completion & Stock Deduction
CREATE OR REPLACE FUNCTION complete_order_and_deduct_stock(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_current_stock NUMERIC;
  v_new_stock NUMERIC;
BEGIN
  -- Fetch order details with FOR UPDATE lock
  SELECT id, status, stock_deducted INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- If already deducted, return success early without re-deducting
  IF v_order.stock_deducted IS TRUE THEN
    UPDATE orders
    SET status = 'completed', updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'already_deducted', true, 'message', 'Order already deducted');
  END IF;

  -- Deduct stock for each order_item atomically
  FOR v_item IN
    SELECT product_id, SUM(quantity) as total_qty
    FROM order_items
    WHERE order_id = p_order_id AND product_id IS NOT NULL
    GROUP BY product_id
  LOOP
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_stock := GREATEST(0, COALESCE(v_current_stock, 0) - v_item.total_qty);
      UPDATE products
      SET stock_quantity = v_new_stock, updated_at = now()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  -- Mark order as completed and stock_deducted = true
  UPDATE orders
  SET status = 'completed', stock_deducted = true, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'stock_deducted', true, 'message', 'Stock deducted and order completed successfully');
END;
$$;

-- 2. Atomic Order Cancellation & Stock Restoration
CREATE OR REPLACE FUNCTION restore_order_stock(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_current_stock NUMERIC;
BEGIN
  SELECT id, status, stock_deducted INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.stock_deducted IS NOT TRUE THEN
    RETURN jsonb_build_object('success', true, 'message', 'No stock to restore');
  END IF;

  FOR v_item IN
    SELECT product_id, SUM(quantity) as total_qty
    FROM order_items
    WHERE order_id = p_order_id AND product_id IS NOT NULL
    GROUP BY product_id
  LOOP
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE products
      SET stock_quantity = COALESCE(v_current_stock, 0) + v_item.total_qty, updated_at = now()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  UPDATE orders
  SET stock_deducted = false, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Stock restored');
END;
$$;
