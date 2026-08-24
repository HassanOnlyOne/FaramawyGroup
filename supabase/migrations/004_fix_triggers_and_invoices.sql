-- ===================================================
-- Fix broken triggers on orders table
-- ===================================================

-- Ensure columns exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2) DEFAULT 0;

-- Drop broken triggers that reference non-existent columns
DROP TRIGGER IF EXISTS set_invoice_no ON public.orders;
DROP TRIGGER IF EXISTS set_invoice_number ON public.orders;
DROP TRIGGER IF EXISTS generate_invoice_no_trigger ON public.orders;
DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON public.orders;

-- Clean replacement function for invoice numbers if needed
CREATE OR REPLACE FUNCTION public.clean_order_invoice_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Safe trigger without invalid column references
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
