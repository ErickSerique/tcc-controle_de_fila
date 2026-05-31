const jwt = require("jsonwebtoken");
const config = require("../config");

/**
 * Valida o JWT de sessão do ticket do cliente na fila.
 * Este token é DIFERENTE do Supabase Auth token — é apenas para
 * vincular o cliente ao ticket sem precisar de conta.
 */
const validateTicketToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de sessão de ticket ausente." });
  }

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.ticketToken = decoded.ticketToken;
    req.roomCode = decoded.roomCode;
    next();
  } catch {
    return res.status(401).json({ error: "Token de sessão inválido ou expirado." });
  }
};

/**
 * Gera um JWT de sessão para o ticket do cliente.
 * Expira em 8 horas (um turno).
 */
const signTicketToken = (ticketToken, roomCode) =>
  jwt.sign({ ticketToken, roomCode }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });

module.exports = { validateTicketToken, signTicketToken };
