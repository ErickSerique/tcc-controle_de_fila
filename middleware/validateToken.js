const jwt = require("jsonwebtoken");
const config = require("../config");

/**
 * Middleware: valida o token de sessão do cliente.
 *
 * O token é assinado com o roomCode embutido, impedindo que um cliente
 * reutilize seu token em outra sala ou manipule a URL para "pular" a fila.
 */
const validateToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de sessão ausente." });
  }

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.sessionToken = decoded.token;
    req.roomCode = decoded.roomCode;
    next();
  } catch {
    return res.status(401).json({ error: "Token de sessão inválido ou expirado." });
  }
};

/**
 * Gera um JWT de sessão vinculado ao ticket e à sala.
 * Expira em 8 horas (um turno de trabalho).
 */
const signSessionToken = (ticketToken, roomCode) =>
  jwt.sign({ token: ticketToken, roomCode }, config.JWT_SECRET, { expiresIn: "8h" });

module.exports = { validateToken, signSessionToken };
