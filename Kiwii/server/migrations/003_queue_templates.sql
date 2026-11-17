-- Migration 003: Modelos de Fila Persistentes por Organização (M2)
CREATE TABLE IF NOT EXISTS org_queue_templates (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  categories JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_queue_templates_org_id ON org_queue_templates(org_id);

ALTER TABLE org_queue_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'org_queue_templates' AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON org_queue_templates TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

