-- =============================================
-- الفرماوي جروب - Audit Logs Schema Enhancements
-- =============================================

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
