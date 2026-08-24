-- =============================================
-- الفرماوي جروب - Audit Logs & User Permissions Migration
-- =============================================

-- 1. Add permissions JSONB column to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"orders":true,"purchases":true,"inventory":true,"customers":true,"suppliers":true,"treasury":true,"reports":true}'::jsonb;

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_name TEXT NOT NULL,
  user_role TEXT DEFAULT 'موظف',
  action_type TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  details TEXT NOT NULL,
  ip_address TEXT DEFAULT '127.0.0.1'
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);

-- 4. Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view and manage audit_logs" ON audit_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'delegate'))
  );
