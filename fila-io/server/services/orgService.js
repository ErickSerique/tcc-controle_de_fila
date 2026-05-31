/**
 * services/orgService.js
 *
 * Gerencia organizations, membros e convites.
 *
 * Toda operação que envolve org é resolvida aqui —
 * as rotas REST apenas validam entrada e chamam este service.
 */
const { pool, supabase } = require("../config/db");

// ── Organizations ─────────────────────────────────────────────────

/**
 * Cria uma nova organization e já adiciona o criador como 'owner'.
 */
const createOrg = async ({ name, userId }) => {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cria a org
    const { rows: orgRows } = await client.query(
      `INSERT INTO organizations (name, slug)
       VALUES ($1, $2)
       RETURNING *`,
      [name, `${slug}-${Date.now().toString(36)}`]
    );
    const org = orgRows[0];

    // Adiciona o criador como owner
    await client.query(
      `INSERT INTO org_members (org_id, user_id, role, accepted_at)
       VALUES ($1, $2, 'owner', NOW())`,
      [org.id, userId]
    );

    await client.query("COMMIT");
    return org;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Lista todas as organizations de um usuário (onde ele é membro aceito).
 */
const listUserOrgs = async (userId) => {
  const { rows } = await pool.query(
    `SELECT o.*, om.role
     FROM organizations o
     JOIN org_members om ON om.org_id = o.id
     WHERE om.user_id = $1 AND om.accepted_at IS NOT NULL
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows;
};

const getOrg = async (orgId) => {
  const { rows } = await pool.query("SELECT * FROM organizations WHERE id = $1", [orgId]);
  return rows[0] ?? null;
};

const updateOrg = async (orgId, { name, operationMode, localServerUrl }) => {
  const { rows } = await pool.query(
    `UPDATE organizations
     SET name = COALESCE($2, name),
         operation_mode = COALESCE($3, operation_mode),
         local_server_url = COALESCE($4, local_server_url)
     WHERE id = $1
     RETURNING *`,
    [orgId, name, operationMode, localServerUrl]
  );
  return rows[0];
};

const deleteOrg = async (orgId) => {
  // Assume que ON DELETE CASCADE está configurado no banco de dados para membros, salas, etc.
  const { rowCount } = await pool.query(
    `DELETE FROM organizations WHERE id = $1`,
    [orgId]
  );
  if (rowCount === 0) throw new Error("Organização não encontrada.");
};

// ── Members ───────────────────────────────────────────────────────

const listMembers = async (orgId) => {
  const { rows } = await pool.query(
    `SELECT om.*, up.name, up.avatar_url
     FROM org_members om
     JOIN user_profiles up ON up.id = om.user_id
     WHERE om.org_id = $1 AND om.accepted_at IS NOT NULL
     ORDER BY om.role DESC, up.name ASC`,
    [orgId]
  );
  return rows;
};

const updateMemberRole = async (orgId, targetUserId, newRole, requestingRole) => {
  // Apenas owner pode promover/rebaixar admins
  if (newRole === "owner" && requestingRole !== "owner") {
    throw new Error("Apenas o owner pode transferir ownership.");
  }

  const { rows } = await pool.query(
    `UPDATE org_members SET role = $3
     WHERE org_id = $1 AND user_id = $2
     RETURNING *`,
    [orgId, targetUserId, newRole]
  );
  if (rows.length === 0) throw new Error("Membro não encontrado.");
  return rows[0];
};

const removeMember = async (orgId, targetUserId, requestingUserId, requestingRole) => {
  // Não pode se remover se for o único owner
  if (requestingUserId === targetUserId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM org_members WHERE org_id = $1 AND role = 'owner'`,
      [orgId]
    );
    if (parseInt(rows[0].cnt) <= 1) {
      throw new Error("Não é possível sair: você é o único owner. Transfira o ownership primeiro.");
    }
  }

  const { rowCount } = await pool.query(
    `DELETE FROM org_members WHERE org_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );
  if (rowCount === 0) throw new Error("Membro não encontrado.");
};

// ── Invites ───────────────────────────────────────────────────────

const inviteMember = async (orgId, { email, role, invitedByUserId }) => {
  // Verifica se já é membro — busca pelo email em auth.users e cruza com org_members
  const { rows: existing } = await pool.query(
    `SELECT om.id
     FROM org_members om
     JOIN auth.users au ON au.id = om.user_id
     WHERE om.org_id = $1
       AND au.email = $2
       AND om.accepted_at IS NOT NULL`,
    [orgId, email]
  );
  if (existing.length > 0) throw new Error("Este usuário já é membro da organização.");

  // Upsert do convite (re-envia se já existia)
  const { rows } = await pool.query(
    `INSERT INTO org_invites (org_id, email, role, invited_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, email)
     DO UPDATE SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by,
                   created_at = NOW(), expires_at = NOW() + INTERVAL '48 hours',
                   accepted_at = NULL,
                   token = encode(gen_random_bytes(32), 'hex')
     RETURNING *`,
    [orgId, email, role, invitedByUserId]
  );
  const invite = rows[0];

  // Envia e-mail via Supabase (quando configurado)
  try {
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: { org_invite_token: invite.token },
    });
  } catch (err) {
    console.warn("[orgService] Supabase invite email falhou:", err.message);
    // Não lança — retorna o token para exibir no painel
  }

  return invite;
};

const acceptInvite = async (token, userId) => {
  const { rows } = await pool.query(
    `SELECT * FROM org_invites
     WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) throw new Error("Convite inválido ou expirado.");

  const invite = rows[0];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO org_members (org_id, user_id, role, invited_by, accepted_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, accepted_at = NOW()`,
      [invite.org_id, userId, invite.role, invite.invited_by]
    );

    await client.query(
      `UPDATE org_invites SET accepted_at = NOW() WHERE id = $1`,
      [invite.id]
    );

    await client.query("COMMIT");
    return invite;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  createOrg,
  listUserOrgs,
  getOrg,
  updateOrg,
  deleteOrg,
  listMembers,
  updateMemberRole,
  removeMember,
  inviteMember,
  acceptInvite,
};
