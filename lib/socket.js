import { io } from "socket.io-client";

/**
 * socket.js — singleton do socket.io-client.
 *
 * Uma única instância é compartilhada por toda a aplicação.
 * Reconecta automaticamente com backoff exponencial.
 * Alvo de latência: < 200ms (implantação na mesma região).
 */
const socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:3001", {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 5000,
  transports: ["websocket", "polling"], // tenta WebSocket primeiro
});

socket.on("connect", () => {
  console.log(`[socket] conectado: ${socket.id}`);
});

socket.on("disconnect", (reason) => {
  console.warn(`[socket] desconectado: ${reason}`);
});

socket.on("connect_error", (err) => {
  console.error(`[socket] erro de conexão: ${err.message}`);
});

socket.on("error", ({ message }) => {
  console.error(`[socket] erro do servidor: ${message}`);
});

export default socket;
