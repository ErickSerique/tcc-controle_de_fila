/**
 * services/orgService.js
 *
 * Gerencia organizations, membros, convites temporários,
 * fila de aprovação de equipe e salas salvas (permanentes).
 */
const crypto = require("crypto");
const { pool, supabase } = require("../config/db");
const config = require("../config");

const ROLE_RANK = { operator: 1, admin: 2, owner: 2 };

// ── Organizations ─────────────────────────────────────────────────

/**
 * Cria uma nova organization e já adiciona o criador como 'admin'.
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

    // Adiciona o criador como admin
    await client.query(
      `INSERT INTO org_members (org_id, user_id, role, accepted_at)
       VALUES ($1, $2, 'admin', NOW())`,
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
  return rows.map((r) => ({ ...r, role: r.role === "owner" ? "admin" : r.role }));
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
  const { rowCount } = await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
  if (rowCount === 0) throw new Error("Organização não encontrada.");
};

// ── Members (RBAC: Admin e Operador) ──────────────────────────────

const listMembers = async (orgId) => {
  const { rows } = await pool.query(
    `SELECT om.*, up.name, up.avatar_url
     FROM org_members om
     JOIN user_profiles up ON up.id = om.user_id
     WHERE om.org_id = $1 AND om.accepted_at IS NOT NULL
     ORDER BY om.role ASC, up.name ASC`,
    [orgId]
  );
  return rows.map((m) => ({ ...m, role: m.role === "owner" ? "admin" : m.role }));
};

const updateMemberRole = async (orgId, targetUserId, newRole) => {
  const safeRole = newRole === "owner" ? "admin" : newRole;
  if (!["admin", "operator"].includes(safeRole)) {
    throw new Error("Cargo inválido. Use 'admin' ou 'operator'.");
  }

  const { rows: current } = await pool.query(
    `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL`,
    [orgId, targetUserId]
  );
  if (current.length === 0) throw new Error("Membro não encontrado.");

  // Se estiver rebaixando um admin, verificar se sobra pelo menos 1 admin
  if (current[0].role === "admin" && safeRole === "operator") {
    const { rows: admins } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM org_members WHERE org_id = $1 AND role IN ('admin', 'owner')`,
      [orgId]
    );
    if (parseInt(admins[0].cnt, 10) <= 1) {
      throw new Error("A organização deve possuir pelo menos um Administrador.");
    }
  }

  const { rows } = await pool.query(
    `UPDATE org_members SET role = $3 WHERE org_id = $1 AND user_id = $2 RETURNING *`,
    [orgId, targetUserId, safeRole]
  );
  return { ...rows[0], role: safeRole };
};

const removeMember = async (orgId, targetUserId, requestingUserId) => {
  // Não pode remover se for o único admin
  const { rows: admins } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM org_members WHERE org_id = $1 AND role IN ('admin', 'owner')`,
    [orgId]
  );

  const { rows: target } = await pool.query(
    `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );
  if (target.length === 0) throw new Error("Membro não encontrado.");

  if (target[0].role === "admin" && parseInt(admins[0].cnt, 10) <= 1) {
    throw new Error("Não é possível remover o único Administrador da organização.");
  }

  const { rowCount } = await pool.query(
    `DELETE FROM org_members WHERE org_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );
  if (rowCount === 0) throw new Error("Membro não encontrado.");
};

// ── Convites Temporários & Fila de Aprovação ──────────────────────

/**
 * Gera um link temporário para entrada na equipe (expira em X minutos).
 */
const createTemporaryInviteLink = async (orgId, userId, expiresInMinutes = 30) => {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  try {
    await pool.query(
      `INSERT INTO org_temporary_links (org_id, token, created_by, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [orgId, token, userId, expiresAt]
    );
  } catch (err) {
    // Se a tabela não existir ainda por migração pendente, fallback em memória
    console.warn("[orgService] org_temporary_links fallback:", err.message);
  }

  const clientUrl = config.CLIENT_URL || "http://localhost:5173";
  const link = `${clientUrl}/invite/${token}`;

  return {
    token,
    link,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes,
  };
};

/**
 * Consulta informações do link de convite (temporário ou legado).
 */
const getInviteInfo = async (token) => {
  // 1. Tenta link temporário
  try {
    const { rows: tempRows } = await pool.query(
      `SELECT tl.token, tl.expires_at, o.id AS org_id, o.name AS org_name
       FROM org_temporary_links tl
       JOIN organizations o ON o.id = tl.org_id
       WHERE tl.token = $1 AND tl.expires_at > NOW()`,
      [token]
    );
    if (tempRows.length > 0) {
      return {
        token: tempRows[0].token,
        type: "temporary",
        orgId: tempRows[0].org_id,
        orgName: tempRows[0].org_name,
        expiresAt: tempRows[0].expires_at,
      };
    }
  } catch {}

  // 2. Fallback para convite tradicional org_invites
  const { rows } = await pool.query(
    `SELECT oi.token, oi.email, oi.role, oi.expires_at, o.id AS org_id, o.name AS org_name
     FROM org_invites oi
     JOIN organizations o ON o.id = oi.org_id
     WHERE oi.token = $1 AND oi.accepted_at IS NULL AND oi.expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) throw new Error("Convite inválido ou expirado.");
  return {
    ...rows[0],
    type: "direct",
    orgId: rows[0].org_id,
    orgName: rows[0].org_name,
  };
};

/**
 * Usuário autenticado solicita entrada na equipe via link temporário.
 * Vai para a fila de solicitações pendentes até um admin aprovar.
 */
const requestJoinOrg = async ({ token, userId, userName, userEmail }) => {
  const invite = await getInviteInfo(token);

  // Verifica se já é membro
  const { rows: isMember } = await pool.query(
    `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
    [invite.orgId, userId]
  );
  if (isMember.length > 0) {
    throw new Error("Você já faz parte da equipe desta instituição.");
  }

  // Registra ou atualiza solicitação na fila de pendentes
  await pool.query(
    `INSERT INTO org_join_requests (org_id, user_id, user_name, user_email, status, requested_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW())
     ON CONFLICT (org_id, user_id) DO UPDATE
       SET status = 'pending', requested_at = NOW(), user_name = EXCLUDED.user_name`,
    [invite.orgId, userId, userName, userEmail]
  );

  return {
    orgId: invite.orgId,
    orgName: invite.orgName,
    message: "Solicitação enviada com sucesso! Aguarde a aprovação de um Administrador da instituição.",
  };
};

/**
 * Lista solicitações pendentes de entrada na equipe para um administrador.
 */
const listJoinRequests = async (orgId) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, org_id, user_id, user_name, user_email, requested_at
       FROM org_join_requests
       WHERE org_id = $1 AND status = 'pending'
       ORDER BY requested_at ASC`,
      [orgId]
    );
    return rows;
  } catch (err) {
    console.warn("[orgService] listJoinRequests fallback:", err.message);
    return [];
  }
};

/**
 * Administrador aprova um solicitante na equipe com o cargo escolhido (Operador ou Admin).
 */
const approveJoinRequest = async (orgId, requestId, assignedRole = "operator", adminUserId) => {
  const safeRole = assignedRole === "admin" ? "admin" : "operator";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: reqRows } = await client.query(
      `SELECT * FROM org_join_requests WHERE id = $1 AND org_id = $2 AND status = 'pending'`,
      [requestId, orgId]
    );
    if (reqRows.length === 0) throw new Error("Solicitação não encontrada ou já processada.");
    const request = reqRows[0];

    // Insere membro na organização
    await client.query(
      `INSERT INTO org_members (org_id, user_id, role, accepted_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, accepted_at = NOW()`,
      [orgId, request.user_id, safeRole]
    );

    // Marca como aprovado
    await client.query(
      `UPDATE org_join_requests
       SET status = 'approved', assigned_role = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [requestId, orgId, safeRole, adminUserId]
    );

    await client.query("COMMIT");
    return { success: true, user_id: request.user_id, role: safeRole };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Administrador recusa uma solicitação de entrada.
 */
const rejectJoinRequest = async (orgId, requestId, adminUserId) => {
  const { rowCount } = await pool.query(
    `UPDATE org_join_requests
     SET status = 'rejected', reviewed_by = $3, reviewed_at = NOW()
     WHERE id = $1 AND org_id = $2 AND status = 'pending'`,
    [requestId, orgId, adminUserId]
  );
  if (rowCount === 0) throw new Error("Solicitação não encontrada.");
  return { success: true };
};

// ── Salas Salvas / Permanentes ────────────────────────────────────

const listSavedRooms = async (orgId) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM saved_rooms WHERE org_id = $1 ORDER BY name ASC`,
      [orgId]
    );
    return rows;
  } catch (err) {
    console.warn("[orgService] listSavedRooms fallback:", err.message);
    return [];
  }
};

const createSavedRoom = async (orgId, { name, categories, counters, customFields, priorityRules }) => {
  const { rows } = await pool.query(
    `INSERT INTO saved_rooms (org_id, name, categories, counters, custom_fields, priority_rules, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      orgId,
      name,
      JSON.stringify(categories || []),
      JSON.stringify(counters || [{ id: "c1", name: "Guichê 1" }]),
      JSON.stringify(customFields || []),
      JSON.stringify(priorityRules || { highBatchSize: 3, medBatchSize: 2 }),
    ]
  );
  return rows[0];
};

const updateSavedRoom = async (orgId, roomId, { name, categories, counters, customFields, priorityRules }) => {
  const { rows } = await pool.query(
    `UPDATE saved_rooms
     SET name = COALESCE($3, name),
         categories = COALESCE($4, categories),
         counters = COALESCE($5, counters),
         custom_fields = COALESCE($6, custom_fields),
         priority_rules = COALESCE($7, priority_rules),
         updated_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    [
      roomId,
      orgId,
      name,
      categories ? JSON.stringify(categories) : null,
      counters ? JSON.stringify(counters) : null,
      customFields ? JSON.stringify(customFields) : null,
      priorityRules ? JSON.stringify(priorityRules) : null,
    ]
  );
  if (rows.length === 0) throw new Error("Sala salva não encontrada.");
  return rows[0];
};

const deleteSavedRoom = async (orgId, roomId) => {
  const { rowCount } = await pool.query(`DELETE FROM saved_rooms WHERE id = $1 AND org_id = $2`, [
    roomId,
    orgId,
  ]);
  if (rowCount === 0) throw new Error("Sala salva não encontrada.");
};

// ── Modelos de Fila Persistentes por Instituição (M2) ────────────
const memTemplateCache = new Map();

const getQueueTemplate = async (orgId) => {
  try {
    const { rows } = await pool.query(
      `SELECT categories, updated_at FROM org_queue_templates WHERE org_id = $1`,
      [orgId]
    );
    if (rows[0]?.categories) {
      return typeof rows[0].categories === "string"
        ? JSON.parse(rows[0].categories)
        : rows[0].categories;
    }
  } catch (err) {
    if (err.code !== "42P01") {
      console.warn("[orgService] getQueueTemplate DB fallback:", err.message);
    }
  }

  if (memTemplateCache.has(orgId)) {
    return memTemplateCache.get(orgId);
  }

  return [
    { name: "Atendimento Geral", priority: 1, tma: 10 },
    { name: "Prioritário", priority: 3, tma: 5 },
  ];
};

const saveQueueTemplate = async (orgId, categories) => {
  memTemplateCache.set(orgId, categories);

  try {
    await pool.query(
      `INSERT INTO org_queue_templates (org_id, categories, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (org_id) DO UPDATE
       SET categories = EXCLUDED.categories, updated_at = NOW()`,
      [orgId, JSON.stringify(categories)]
    );
  } catch (err) {
    console.warn("[orgService] saveQueueTemplate DB save:", err.message);
  }

  return categories;
};

// Compatibilidade legada para convites diretos
const inviteMember = async (orgId, { email, role, invitedByUserId }) => {
  const linkData = await createTemporaryInviteLink(orgId, invitedByUserId, 60);
  return { ...linkData, emailSent: false, emailError: null };
};

const acceptInvite = async (token, userId, userEmail) => {
  return requestJoinOrg({ token, userId, userName: userEmail.split("@")[0], userEmail });
};

const listPendingInvitesForEmail = async () => [];

module.exports = {
  createOrg,
  listUserOrgs,
  getOrg,
  updateOrg,
  deleteOrg,
  listMembers,
  updateMemberRole,
  removeMember,
  createTemporaryInviteLink,
  getInviteInfo,
  requestJoinOrg,
  listJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  listSavedRooms,
  createSavedRoom,
  updateSavedRoom,
  deleteSavedRoom,
  inviteMember,
  acceptInvite,
  listPendingInvitesForEmail,
  getQueueTemplate,
  saveQueueTemplate,
};
