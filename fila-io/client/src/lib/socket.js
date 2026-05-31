/**
 * client/src/lib/socket.js
 *
 * Socket.io client com suporte a autenticação.
 *
 * - Hosts conectam com token Supabase (via connectWithAuth)
 * - Clientes da fila conectam sem token (anônimos)
 * - Reconnecta automaticamente com backoff exponencial.
 */
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3_000,
  timeout: 5_000,
  transports: ["websocket", "polling"],
});

/**
 * Reconecta o socket com token de autenticação do Supabase.
 * Chamado pelo useAuth quando a sessão é estabelecida.
 */
export const connectWithAuth = (accessToken) => {
  if (socket.connected) socket.disconnect();
  socket.auth = { token: accessToken };
  socket.connect();
};

/**
 * Desconecta e reconecta como anônimo (após logout).
 */
export const connectAnonymous = () => {
  if (socket.connected) socket.disconnect();
  socket.auth = {};
  socket.connect();
};

socket.on("connect",       () => console.log(`[socket] conectado: ${socket.id}`));
socket.on("disconnect",    (r) => console.warn(`[socket] desconectado: ${r}`));
socket.on("connect_error", (e) => console.error(`[socket] erro: ${e.message}`));

export default socket;
