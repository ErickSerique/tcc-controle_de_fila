/**
 * utils/roleLevel.js
 *
 * Hierarquia de cargos do Kiwii:
 * - operator (1): Funcionário. Abre o dia, opera guichês, atende, chama de volta, tranca a fila e encerra o dia.
 * - admin (2): Administrador. Faz tudo do operador + gerencia salas, configurações e membros da equipe.
 * (Cargo 'owner' removido conforme novas prioridades; mapeado para admin para compatibilidade retroativa)
 */
const ROLE_LEVEL = {
  operator: 1,
  admin: 2,
  owner: 2,
};

const hasRole = (role, minRole) => {
  const userLevel = ROLE_LEVEL[role] || 0;
  const targetLevel = ROLE_LEVEL[minRole] || 0;
  return userLevel >= targetLevel;
};

module.exports = { ROLE_LEVEL, hasRole };
