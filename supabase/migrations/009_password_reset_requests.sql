-- =============================================
-- Password Reset Requests Table Migration
-- =============================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_or_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast status query
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);

-- Enable RLS
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public insert to password_reset_requests" ON password_reset_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin to manage password_reset_requests" ON password_reset_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner', 'super_owner', 'manager', 'staff'))
  );
