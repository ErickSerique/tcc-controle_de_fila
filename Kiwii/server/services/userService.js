/**
 * services/userService.js
 *
 * Gerenciamento de perfil e ciclo de vida da conta do usuário.
 */
const { pool, supabase } = require("../config/db");

/**
 * Atualiza o nome e metadados do perfil do usuário em user_profiles.
 */
const updateProfile = async (userId, { name, avatarUrl }) => {
  const { rows } = await pool.query(
    `INSERT INTO user_profiles (id, name, avatar_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
           updated_at = NOW()
     RETURNING *`,
    [userId, name, avatarUrl ?? null]
  );
  return rows[0];
};

/**
 * Exclui a conta do usuário e desfaz vínculos com integridade referencial.
 *
 * Regras:
 * 1. Impede exclusão se o usuário for o único Administrador em uma organização com outros membros.
 * 2. Se o usuário for o único membro de uma organização, a organização é excluída integralmente (cascade).
 * 3. Desvincula o usuário de salas e relatórios onde é referenciado em chaves estrangeiras sem cascade.
 * 4. Exclui convites enviados pelo usuário.
 * 5. Remove associações restantes em org_members.
 * 6. Exclui user_profiles.
 * 7. Exclui do Supabase Auth (se admin estiver configurado).
 */
const deleteUserAccount = async (userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verifica se é único admin em organizações que possuem outros membros
    const { rows: blockerOrgs } = await client.query(
      `SELECT o.id, o.name
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.role IN ('admin', 'owner')
         AND (
           SELECT COUNT(*) FROM org_members om2
           WHERE om2.org_id = o.id AND om2.role IN ('admin', 'owner') AND om2.user_id != $1
         ) = 0
         AND (
           SELECT COUNT(*) FROM org_members om3
           WHERE om3.org_id = o.id AND om3.user_id != $1
         ) > 0`,
      [userId]
    );

    if (blockerOrgs.length > 0) {
      const orgNames = blockerOrgs.map((o) => `"${o.name}"`).join(", ");
      throw new Error(
        `Não é possível excluir a conta: você é o único Administrador da organização ${orgNames}, que possui outros membros. Promova outro membro a Administrador ou transfira a organização antes de excluir sua conta.`
      );
    }

    // 2. Identifica organizações onde este usuário é o ÚNICO membro (exclui a organização)
    const { rows: soloOrgs } = await client.query(
      `SELECT o.id
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1
         AND (SELECT COUNT(*) FROM org_members om2 WHERE om2.org_id = o.id) = 1`,
      [userId]
    );

    if (soloOrgs.length > 0) {
      const soloIds = soloOrgs.map((o) => o.id);
      await client.query(
        `DELETE FROM organizations WHERE id = ANY($1::uuid[])`,
        [soloIds]
      );
    }

    // 3. Remove convites enviados pelo usuário
    await client.query(`DELETE FROM org_invites WHERE invited_by = $1`, [userId]);

    // 4. Desvincula salas abertas ou fechadas pelo usuário (para manter histórico de sala)
    await client.query(
      `UPDATE rooms SET opened_by = NULL WHERE opened_by = $1`,
      [userId]
    );
    await client.query(
      `UPDATE rooms SET closed_by = NULL WHERE closed_by = $1`,
      [userId]
    );

    // 5. Desvincula relatórios históricos gerados pelo usuário (se tabela existir)
    await client.query(
      `UPDATE reports SET generated_by = NULL WHERE generated_by = $1`
    ).catch(() => {});

    // 6. Remove associações restantes de org_members
    await client.query(`DELETE FROM org_members WHERE user_id = $1`, [userId]);

    // 7. Remove perfil do usuário
    await client.query(`DELETE FROM user_profiles WHERE id = $1`, [userId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // 8. Tenta excluir do Supabase Auth Admin
  if (supabase?.auth?.admin?.deleteUser) {
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (sbErr) {
      console.warn("[userService] Aviso ao deletar no Supabase Auth:", sbErr.message);
    }
  }

  return { success: true };
};

module.exports = {
  updateProfile,
  deleteUserAccount,
};
