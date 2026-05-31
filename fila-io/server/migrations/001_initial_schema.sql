-- ============================================================
-- fila.io — Schema PostgreSQL v2.0
-- Execute via: npm run db:migrate (server)
-- Compatible com Supabase e PostgreSQL self-hosted >= 14
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────

CREATE TYPE org_member_role AS ENUM ('owner', 'admin', 'operator');
CREATE TYPE ticket_status   AS ENUM ('waiting', 'called', 'served', 'abandoned', 'removed');
CREATE TYPE operation_mode  AS ENUM ('cloud', 'hybrid');
CREATE TYPE sync_origin     AS ENUM ('cloud', 'local');

-- ── ORGANIZATIONS ─────────────────────────────────────────────────
-- Um estabelecimento = uma organization.
-- Suporte a múltiplos planos (free, pro, enterprise).

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(120) NOT NULL,
  slug            VARCHAR(80)  UNIQUE NOT NULL,  -- ex: "clinica-central"
  plan            VARCHAR(20)  NOT NULL DEFAULT 'free',
  operation_mode  operation_mode NOT NULL DEFAULT 'cloud',
  -- Para modo híbrido: URL LAN do servidor local
  local_server_url VARCHAR(255),
  -- Metadados
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── USERS (espelho do Supabase Auth) ─────────────────────────────
-- auth.users é gerenciado pelo Supabase.
-- Esta tabela armazena dados de perfil adicionais.

CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY,  -- mesmo id do auth.users (Supabase)
  name        VARCHAR(120) NOT NULL,
  avatar_url  VARCHAR(500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ORGANIZATION MEMBERS ──────────────────────────────────────────
-- Relacionamento N:N entre usuários e organizations com roles.

CREATE TABLE org_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role         org_member_role NOT NULL DEFAULT 'operator',
  invited_by   UUID REFERENCES user_profiles(id),
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);

-- ── INVITES ───────────────────────────────────────────────────────
-- Convites por e-mail para entrar em uma organization.

CREATE TABLE org_invites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  role        org_member_role NOT NULL DEFAULT 'operator',
  token       VARCHAR(128) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  UUID NOT NULL REFERENCES user_profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  accepted_at TIMESTAMPTZ,
  UNIQUE(org_id, email)
);

-- ── ROOMS ─────────────────────────────────────────────────────────
-- Uma sala de atendimento por turno/dia.

CREATE TABLE rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code        CHAR(6)      NOT NULL UNIQUE,   -- código público de 6 chars
  name        VARCHAR(120) NOT NULL,
  -- Categorias: [{ name, priority, tma }]
  categories  JSONB        NOT NULL DEFAULT '[]',
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  opened_by   UUID         REFERENCES user_profiles(id),
  closed_by   UUID         REFERENCES user_profiles(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE INDEX idx_rooms_org_id ON rooms(org_id);
CREATE INDEX idx_rooms_code   ON rooms(code) WHERE active = TRUE;

-- ── TICKETS ───────────────────────────────────────────────────────
-- Um ticket por atendimento (entrada na fila).

CREATE TABLE tickets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id        UUID         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token          VARCHAR(128) NOT NULL UNIQUE,  -- token de sessão do cliente
  name           VARCHAR(120) NOT NULL,
  category       VARCHAR(80)  NOT NULL,
  priority       SMALLINT     NOT NULL CHECK (priority IN (1, 2, 3)),
  tma            SMALLINT     NOT NULL CHECK (tma > 0),
  status         ticket_status NOT NULL DEFAULT 'waiting',
  manual         BOOLEAN      NOT NULL DEFAULT FALSE,  -- adicionado pelo host
  -- Posição e espera — calculados em memória (Redis), aqui é snapshot
  position       INTEGER,
  estimated_wait INTEGER,  -- minutos
  joined_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  called_at      TIMESTAMPTZ,
  served_at      TIMESTAMPTZ
);

CREATE INDEX idx_tickets_room_id ON tickets(room_id);
CREATE INDEX idx_tickets_token   ON tickets(token);
CREATE INDEX idx_tickets_status  ON tickets(room_id, status) WHERE status = 'waiting';

-- ── SESSION REPORTS ───────────────────────────────────────────────
-- Relatório gerado ao encerrar o dia.

CREATE TABLE session_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id),
  room_id          UUID REFERENCES rooms(id),
  room_code        CHAR(6)     NOT NULL,
  room_name        VARCHAR(120) NOT NULL,
  total_served     INTEGER     NOT NULL DEFAULT 0,
  total_abandoned  INTEGER     NOT NULL DEFAULT 0,
  avg_wait_minutes NUMERIC(6,1),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by     UUID REFERENCES user_profiles(id)
);

-- ── SYNC LOG (Modo Híbrido) ────────────────────────────────────────
-- Fila de eventos gerados offline para sincronizar com a cloud.

CREATE TABLE sync_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID        NOT NULL REFERENCES organizations(id),
  event_type   VARCHAR(60) NOT NULL,  -- 'ticket.join', 'ticket.called', etc.
  payload      JSONB       NOT NULL,
  origin       sync_origin NOT NULL DEFAULT 'local',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at    TIMESTAMPTZ,           -- NULL = pendente
  sync_error   TEXT                   -- erro da última tentativa
);

CREATE INDEX idx_sync_log_pending ON sync_log(org_id, synced_at) WHERE synced_at IS NULL;

-- ── TRIGGERS: updated_at automático ───────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW LEVEL SECURITY (Supabase) ─────────────────────────────────
-- Ativa RLS em todas as tabelas sensíveis.
-- As políticas permitem acesso apenas via service_role no servidor
-- ou via JWT do Supabase Auth no cliente (quando aplicável).

ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log        ENABLE ROW LEVEL SECURITY;

-- Política base: service_role (nosso servidor) tem acesso total
CREATE POLICY "service_role full access" ON organizations   TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role full access" ON user_profiles   TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role full access" ON org_members     TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role full access" ON org_invites     TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role full access" ON rooms           TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role full access" ON tickets         TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role full access" ON session_reports TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "service_role full access" ON sync_log        TO service_role USING (TRUE) WITH CHECK (TRUE);
