-- ============================================================
-- Kiwii — Migration 002: Audit Log
-- Registra ações de operadores/administradores por sala
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,
  room_code      VARCHAR(10) NOT NULL,
  actor_user_id  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  actor_name     VARCHAR(120),
  actor_role     VARCHAR(30) DEFAULT 'operator',
  action         VARCHAR(80) NOT NULL,
  details        JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_room_code ON audit_log(room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON audit_log(org_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON audit_log TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;
