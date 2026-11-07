/** Hierarquia de cargos compartilhada entre REST e Socket.io. */
const ROLE_LEVEL = { operator: 1, admin: 2, owner: 3 };
const hasRole = (role, minRole) => (ROLE_LEVEL[role] || 0) >= (ROLE_LEVEL[minRole] || 0);
module.exports = { ROLE_LEVEL, hasRole };
