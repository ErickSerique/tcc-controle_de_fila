-- ============================================================
-- Kiwii — Migration 004: Sessões Permanentes, Salas Salvas e Fila de Convites
-- ============================================================

-- 1. Normalização de cargos: converter 'owner' em 'admin'
DO $$
BEGIN
  -- Se o tipo org_member_role existir, permitir atualização de registros
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_member_role') THEN
    UPDATE org_members SET role = 'admin' WHERE role = 'owner';
  END IF;
END $$;

-- 2. Tabela de Salas Permanentes da Organização
CREATE TABLE IF NOT EXISTS saved_rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  categories      JSONB NOT NULL DEFAULT '[]',
  counters        JSONB NOT NULL DEFAULT '[]',
  custom_fields   JSONB NOT NULL DEFAULT '[]',
  priority_rules  JSONB NOT NULL DEFAULT '{"highBatchSize": 3, "medBatchSize": 2}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_rooms_org_id ON saved_rooms(org_id);

-- 3. Tabela de Sessões Históricas (Dias Encerrados) com Auditoria Completa
CREATE TABLE IF NOT EXISTS room_sessions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_code               VARCHAR(10) NOT NULL,
  room_name               VARCHAR(120) NOT NULL,
  opened_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by               VARCHAR(120),
  closed_by_user_id       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  total_served            INTEGER NOT NULL DEFAULT 0,
  total_removed_by_host   INTEGER NOT NULL DEFAULT 0,
  total_left_voluntarily  INTEGER NOT NULL DEFAULT 0,
  total_abandoned_in_queue INTEGER NOT NULL DEFAULT 0,
  avg_wait_minutes        NUMERIC(6,1) NOT NULL DEFAULT 0,
  tickets_data            JSONB NOT NULL DEFAULT '[]',
  logs_data               JSONB NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_sessions_org_id ON room_sessions(org_id, closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_sessions_code ON room_sessions(room_code);

-- 4. Tabela de Links Temporários de Convite da Organização
CREATE TABLE IF NOT EXISTS org_temporary_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token           VARCHAR(64) UNIQUE NOT NULL,
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_org_temp_links_token ON org_temporary_links(token);

-- 5. Fila de Solicitações de Entrada na Equipe (Aprovação por Admin)
CREATE TABLE IF NOT EXISTS org_join_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_name       VARCHAR(120) NOT NULL,
  user_email      VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  assigned_role   VARCHAR(20) DEFAULT 'operator',        -- 'operator' ou 'admin'
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_join_requests ON org_join_requests(org_id, status);

-- Permissões de RLS
ALTER TABLE saved_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_temporary_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_join_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_rooms' AND policyname = 'service_role full access') THEN
    CREATE POLICY "service_role full access" ON saved_rooms TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_sessions' AND policyname = 'service_role full access') THEN
    CREATE POLICY "service_role full access" ON room_sessions TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_temporary_links' AND policyname = 'service_role full access') THEN
    CREATE POLICY "service_role full access" ON org_temporary_links TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_join_requests' AND policyname = 'service_role full access') THEN
    CREATE POLICY "service_role full access" ON org_join_requests TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;
