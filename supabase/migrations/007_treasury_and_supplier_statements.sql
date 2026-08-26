-- ==============================================================
-- الفرماوي جروب - Treasury Transactions & Supplier Statements Migration
-- ==============================================================

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  inflow NUMERIC(12,2) DEFAULT 0,
  outflow NUMERIC(12,2) DEFAULT 0,
  party TEXT,
  party_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_treasury_tx_created_at ON treasury_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_party_id ON treasury_transactions(party_id);

ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated to read and manage treasury_transactions"
  ON treasury_transactions FOR ALL USING (true);

-- Supplier payments table
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'كاش نقدي',
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'كاش نقدي';
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_created_at ON supplier_payments(created_at DESC);

ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to manage supplier_payments"
  ON supplier_payments FOR ALL USING (true);
