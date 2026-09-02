-- =============================================
-- Migration 012: Create delegates table
-- =============================================

CREATE TABLE IF NOT EXISTS public.delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  territory TEXT,
  route_name TEXT,
  customer_code TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delegates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated/anon or admin operations
CREATE POLICY "Allow full access on delegates" ON public.delegates
  FOR ALL USING (true) WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_delegates_created_at ON public.delegates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delegates_customer_code ON public.delegates(customer_code);
