-- ==============================================================
-- الفرماوي جروب - Sync Suppliers Balance & Company Columns Migration
-- ==============================================================

-- Ensure suppliers table has all compatible column variations for balance and company
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_name TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(12,2) DEFAULT 0;

    -- Sync existing values if one is null and another is present
    UPDATE suppliers 
    SET 
      company = COALESCE(company, company_name),
      company_name = COALESCE(company_name, company),
      balance = COALESCE(balance, current_balance, opening_balance, initial_balance, 0),
      current_balance = COALESCE(current_balance, balance, opening_balance, initial_balance, 0),
      opening_balance = COALESCE(opening_balance, initial_balance, balance, current_balance, 0),
      initial_balance = COALESCE(initial_balance, opening_balance, balance, current_balance, 0);
  END IF;
END $$;
