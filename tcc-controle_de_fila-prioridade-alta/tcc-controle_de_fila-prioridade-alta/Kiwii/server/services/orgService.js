/**
 * services/orgService.js
 *
 * Gerencia organizations, membros e convites.
 *
 * Toda operação que envolve org é resolvida aqui —
 * as rotas REST apenas validam entrada e chamam este service.
 */
const { pool, supabase } = require("../config/db");
const config = require("../config");

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
     ORDER BY om.role ASC, up.name ASC`,
    [orgId]
  );
  return rows;
};

const updateMemberRole = async (orgId, targetUserId, newRole, requestingRole) => {
  const { rows: current } = await pool.query(
    `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL`,
    [orgId, targetUserId]
  );
  if (current.length === 0) throw new Error("Membro não encontrado.");

  // Hierarquia: só o Dono mexe no cargo de outro Dono ou transfere a propriedade.
  if (current[0].role === "owner" && requestingRole !== "owner") {
    throw new Error("Apenas o Dono pode alterar o cargo de outro Dono.");
  }
  if (newRole === "owner" && requestingRole !== "owner") {
    throw new Error("Apenas o Dono pode transferir a propriedade.");
  }

  const { rows } = await pool.query(
    `UPDATE org_members SET role = $3 WHERE org_id = $1 AND user_id = $2 RETURNING *`,
    [orgId, targetUserId, newRole]
  );
  return rows[0];
};

const removeMember = async (orgId, targetUserId, requestingUserId, requestingRole) => {
  const { rows: target } = await pool.query(
    `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );
  if (target[0]?.role === "owner" && requestingRole !== "owner") {
    throw new Error("Apenas o Dono pode remover outro Dono.");
  }

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
       AND LOWER(au.email) = LOWER($2)
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
  const clientUrl = config.CLIENT_URL || "http://localhost:5173";
  const link = `${clientUrl}/invite/${invite.token}`;

  // O e-mail do Supabase costuma falhar em contas gratuitas (cota baixa, Site URL não
  // configurado, ou usuário que já tem conta). Nunca dependemos só dele: o link sempre
  // funciona e devolvemos explicitamente se o e-mail foi enviado.
  let emailSent = false;
  let emailError = null;
  try {
    if (supabase?.auth?.admin?.inviteUserByEmail) {
      const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { org_invite_token: invite.token },
      });
      if (error) throw error;
      emailSent = true;
    }
  } catch (err) {
    emailError = err.message;
    console.warn("[orgService] Supabase invite email falhou:", err.message);
  }

  return { ...invite, link, emailSent, emailError };
};

/** Prévia pública de um convite (sem login). */
const getInviteInfo = async (token) => {
  const { rows } = await pool.query(
    `SELECT oi.email, oi.role, oi.expires_at, oi.accepted_at, o.name AS org_name
     FROM org_invites oi JOIN organizations o ON o.id = oi.org_id
     WHERE oi.token = $1`,
    [token]
  );
  if (rows.length === 0) throw new Error("Convite não encontrado.");
  const row = rows[0];
  if (row.accepted_at) throw new Error("Este convite já foi utilizado.");
  if (new Date(row.expires_at) < new Date()) throw new Error("Este convite expirou.");
  return { orgName: row.org_name, role: row.role, email: row.email };
};

const ROLE_RANK = { operator: 1, admin: 2, owner: 3 };

/**
 * Aceita um convite. Nominal: só o e-mail convidado pode aceitar. Se a pessoa já é
 * membro com cargo igual ou maior, o cargo atual é mantido (convite nunca rebaixa).
 */
const acceptInvite = async (token, userId, userEmail) => {
  const { rows } = await pool.query(
    `SELECT * FROM org_invites WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) throw new Error("Convite inválido ou expirado.");

  const invite = rows[0];
  if (userEmail && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error(`Este convite foi enviado para outro e-mail (${invite.email}). Entre com essa conta para aceitá-lo.`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: existing } = await client.query(
      `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [invite.org_id, userId]
    );
    const keepRole = !!(existing[0] && ROLE_RANK[existing[0].role] >= ROLE_RANK[invite.role]);

    await client.query(
      `INSERT INTO org_members (org_id, user_id, role, invited_by, accepted_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (org_id, user_id) DO UPDATE
         SET role = CASE WHEN $5 THEN org_members.role ELSE EXCLUDED.role END,
             accepted_at = COALESCE(org_members.accepted_at, NOW())`,
      [invite.org_id, userId, invite.role, invite.invited_by, keepRole]
    );
    await client.query(`UPDATE org_invites SET accepted_at = NOW() WHERE id = $1`, [invite.id]);
    await client.query("COMMIT");
    return invite;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/** Convites pendentes (não aceitos e não expirados) enviados para um e-mail. */
const listPendingInvitesForEmail = async (email) => {
  if (!email) return [];
  const { rows } = await pool.query(
    `SELECT oi.token, oi.role, oi.expires_at, o.name AS org_name
     FROM org_invites oi JOIN organizations o ON o.id = oi.org_id
     WHERE LOWER(oi.email) = LOWER($1) AND oi.accepted_at IS NULL AND oi.expires_at > NOW()
     ORDER BY oi.created_at DESC`,
    [email]
  );
  return rows;
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
  getInviteInfo,
  listPendingInvitesForEmail,
};
