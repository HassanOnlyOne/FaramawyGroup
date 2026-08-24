-- =============================================
-- الفرماوي جروب - B2B Wholesale Platform Migration
-- =============================================

-- 1. Add 'delegate' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delegate';

-- 2. ALTER profiles table - add B2B fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS customer_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_enabled BOOLEAN DEFAULT false;

-- 3. ALTER products table - add wholesale fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_quantity INT DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_unit TEXT DEFAULT 'كرتونة';

-- 4. ALTER orders table - add B2B invoice/accounting fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_no TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'credit'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_code TEXT DEFAULT '1';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_name_ref TEXT DEFAULT 'المخزن الرئيسي';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delegate_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2) DEFAULT 0;

-- 5. Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  received_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create invoice_no sequence and trigger
CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START WITH 1;

CREATE OR REPLACE FUNCTION generate_invoice_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_no IS NULL THEN
    NEW.invoice_no := 'INV-' || LPAD(nextval('invoice_no_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_no ON orders;
CREATE TRIGGER set_invoice_no
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_no();

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_no ON orders(invoice_no);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_products_sku_code ON products(sku_code);
CREATE INDEX IF NOT EXISTS idx_profiles_customer_code ON profiles(customer_code);

-- 8. RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payments" ON payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Customers can view own payments" ON payments
  FOR SELECT USING (customer_id = auth.uid());
