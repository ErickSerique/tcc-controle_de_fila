-- Migration 003: Modelos de Fila Persistentes por Organização (M2)
CREATE TABLE IF NOT EXISTS org_queue_templates (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  categories JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_queue_templates_org_id ON org_queue_templates(org_id);

