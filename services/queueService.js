const { v4: uuidv4 } = require("uuid");
const { rooms, recalcPositions } = require("./roomService");

/**
 * queueService.js
 * Toda a lógica de operações na fila: entrar, chamar, remover, priorizar.
 */

/**
 * Adiciona um cliente à fila com token de sessão único.
 * O token também é assinado via JWT na camada de middleware (validateToken.js)
 * para impedir manipulação de URL.
 */
const joinQueue = (roomCode, { name, category, manual = false }) => {
  const room = rooms.get(roomCode);
  if (!room || !room.active) throw new Error("Sala inativa ou inexistente.");

  const catConfig = room.categories.find((c) => c.name === category);
  if (!catConfig) throw new Error(`Categoria "${category}" não existe nesta sala.`);

  // Token único por ticket — impossível de adivinhar ou reutilizar
  const token = `${roomCode}-${uuidv4()}`;

  const ticket = {
    token,
    name: name.trim().substring(0, 80), // sanitiza tamanho
    category,
    priority: catConfig.priority,       // 1 (baixa) | 2 (média) | 3 (alta)
    tma: catConfig.tma,                 // Tempo Médio de Atendimento em minutos
    joinedAt: Date.now(),
    status: "waiting",
    manual,                             // true = adicionado pelo host sem smartphone
    position: 0,
    estimatedWait: 0,
  };

  room.queue.push(ticket);
  recalcPositions(room.queue);
  return ticket;
};

/**
 * Chama o próximo ticket de maior prioridade.
 * Remove da fila ativa e move para room.called (histórico).
 */
const callNext = (roomCode) => {
  const room = rooms.get(roomCode);
  if (!room || room.queue.length === 0) return null;

  // Fila já está ordenada por recalcPositions — primeiro item é sempre o próximo
  const next = room.queue.shift();
  next.status = "called";
  next.calledAt = Date.now();
  room.called.push(next);

  recalcPositions(room.queue);
  return next;
};

/**
 * Remove um ticket específico da fila (ex: cliente que foi embora).
 */
const removeTicket = (roomCode, token) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  const before = room.queue.length;
  room.queue = room.queue.filter((t) => t.token !== token);
  if (room.queue.length === before) throw new Error("Ticket não encontrado na fila.");

  recalcPositions(room.queue);
  return room.queue;
};

/**
 * Altera o peso de prioridade de um ticket já na fila.
 * Dispara reordenação imediata.
 */
const changePriority = (roomCode, token, newPriority) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  if (![1, 2, 3].includes(newPriority)) throw new Error("Prioridade inválida. Use 1, 2 ou 3.");

  const ticket = room.queue.find((t) => t.token === token);
  if (!ticket) throw new Error("Ticket não encontrado na fila.");

  ticket.priority = newPriority;
  recalcPositions(room.queue);
  return room.queue;
};

/** Retorna snapshot atual da fila de uma sala. */
const getQueue = (roomCode) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");
  return room.queue;
};

module.exports = { joinQueue, callNext, removeTicket, changePriority, getQueue };
