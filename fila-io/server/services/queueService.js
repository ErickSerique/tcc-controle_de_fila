const { v4: uuidv4 } = require("uuid");
const { rooms, recalcPositions } = require("./roomService");
const { logAction } = require("./logService");

/**
 * queueService.js
 *
 * Toda a lógica de operações na fila: entrar, chamar, remover,
 * priorizar e "chamar de volta" (recall) tickets que já saíram.
 *
 * Ciclo de vida de um ticket:
 *
 *   waiting → called → served
 *           ↘ removed_by_host   (host removeu)
 *           ↘ left_voluntarily  (cliente saiu pelo próprio celular)
 *
 * Qualquer status terminal (served / removed_by_host / left_voluntarily)
 * pode ser "recallado" via recallTicket() — para o guichê direto ou de
 * volta ao início da fila.
 */

const pushTimeline = (ticket, status) => {
  if (!ticket.timeline) ticket.timeline = [];
  ticket.timeline.push({ status, at: Date.now() });
};

/**
 * Adiciona um cliente à fila.
 * @param {object} extra - { name, category, manual, customData }
 *   customData: { [fieldId]: valor } — respostas aos campos personalizados
 */
const joinQueue = (roomCode, { name, category, manual = false, customData = {} }) => {
  const room = rooms.get(roomCode);
  if (!room || !room.active) throw new Error("Sala inativa ou inexistente.");

  const catConfig = room.categories.find((c) => c.name === category);
  if (!catConfig) throw new Error(`Categoria "${category}" não existe nesta sala.`);

  // Valida campos obrigatórios personalizados definidos pelo host
  for (const field of room.customFields || []) {
    if (!field.required) continue;
    const val = customData[field.id];
    const empty = field.type === "checkbox" ? !val : !val?.toString().trim();
    if (empty) throw new Error(`Campo obrigatório não preenchido: ${field.label}`);
  }

  // Snapshot legível dos campos personalizados (útil para exibição/exportação,
  // já que customData é indexado por ID e não é amigável para leitura humana)
  const customDataEntries = (room.customFields || []).map((field) => ({
    fieldId: field.id,
    label: field.label,
    value: customData[field.id] ?? "",
  }));

  const token = `${roomCode}-${uuidv4()}`;

  const ticket = {
    token,
    name: name.trim().substring(0, 80),
    category,
    priority: catConfig.priority,
    tma: catConfig.tma,
    joinedAt: Date.now(),
    status: "waiting",
    manual,
    customData,
    customDataEntries,
    position: 0,
    estimatedWait: 0,
    counter: null,
    timeline: [{ status: "waiting", at: Date.now() }],
  };

  room.queue.push(ticket);
  recalcPositions(room.queue);
  return ticket;
};

/** Chama o próximo ticket de maior prioridade e o direciona a um guichê. */
const callNext = (roomCode, { counter, actor } = {}) => {
  const room = rooms.get(roomCode);
  if (!room || room.queue.length === 0) return null;

  const next = room.queue.shift();
  next.status = "called";
  next.calledAt = Date.now();
  next.counter = counter || room.counters[0]?.name || "Guichê Único";
  pushTimeline(next, "called");
  room.archive.unshift(next);

  recalcPositions(room.queue);
  logAction(room, actor, "ticket.called", {
    token: next.token,
    name: next.name,
    counter: next.counter,
  });
  return next;
};

/** Chama um ticket específico (fora de ordem) e o direciona a um guichê. */
const callSpecific = (roomCode, token, { counter, actor } = {}) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  const idx = room.queue.findIndex((t) => t.token === token);
  if (idx === -1) throw new Error("Ticket não encontrado na fila.");

  const [ticket] = room.queue.splice(idx, 1);
  ticket.status = "called";
  ticket.calledAt = Date.now();
  ticket.counter = counter || room.counters[0]?.name || "Guichê Único";
  pushTimeline(ticket, "called");
  room.archive.unshift(ticket);

  recalcPositions(room.queue);
  logAction(room, actor, "ticket.called_specific", {
    token,
    name: ticket.name,
    counter: ticket.counter,
  });
  return ticket;
};

/** Confirma que o ticket chamado foi efetivamente atendido. */
const confirmServed = (roomCode, token, { actor } = {}) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  const ticket = room.archive.find((t) => t.token === token && t.status === "called");
  if (!ticket) throw new Error("Ticket não encontrado ou já finalizado.");

  ticket.status = "served";
  ticket.servedAt = Date.now();
  pushTimeline(ticket, "served");
  logAction(room, actor, "ticket.served", { token, name: ticket.name });
  return ticket;
};

/** HOST remove um ticket da fila (ex: no-show). Move para o arquivo do dia. */
const removeTicket = (roomCode, token, { actor } = {}) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  const idx = room.queue.findIndex((t) => t.token === token);
  if (idx === -1) throw new Error("Ticket não encontrado na fila.");

  const [ticket] = room.queue.splice(idx, 1);
  ticket.status = "removed_by_host";
  ticket.removedAt = Date.now();
  pushTimeline(ticket, "removed_by_host");
  room.archive.unshift(ticket);

  recalcPositions(room.queue);
  logAction(room, actor, "ticket.removed", { token, name: ticket.name });
  return room.queue;
};

/** CLIENTE sai voluntariamente da fila pelo próprio celular. */
const leaveQueue = (roomCode, token) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  const idx = room.queue.findIndex((t) => t.token === token);
  if (idx === -1) throw new Error("Ticket não encontrado na fila.");

  const [ticket] = room.queue.splice(idx, 1);
  ticket.status = "left_voluntarily";
  ticket.leftAt = Date.now();
  pushTimeline(ticket, "left_voluntarily");
  room.archive.unshift(ticket);

  recalcPositions(room.queue);
  // Ação do cliente, não do staff — registrado com role "client" para deixar claro nos logs
  logAction(room, { name: ticket.name, role: "client" }, "ticket.left_voluntarily", { token });
  return room.queue;
};

/**
 * Recall unificado: traz de volta um ticket arquivado (servido, removido
 * ou que saiu voluntariamente).
 *
 * mode: 'counter'     → chama direto para um guichê (pula a fila)
 *       'queue_front' → volta para o início da fila, respeitando a
 *                        prioridade original da categoria do ticket
 */
const recallTicket = (roomCode, token, { mode, counter, actor } = {}) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");

  const ticket = room.archive.find((t) => t.token === token);
  if (!ticket) throw new Error("Ticket não encontrado no histórico do dia.");

  if (mode === "counter") {
    ticket.status = "called";
    ticket.calledAt = Date.now();
    ticket.counter = counter || room.counters[0]?.name || "Guichê Único";
    ticket.servedAt = null;
    ticket.removedAt = null;
    ticket.leftAt = null;
    pushTimeline(ticket, "recalled_to_counter");
    logAction(room, actor, "ticket.recalled_counter", {
      token,
      name: ticket.name,
      counter: ticket.counter,
    });
    return { mode, ticket };
  }

  if (mode === "queue_front") {
    const archiveIdx = room.archive.indexOf(ticket);
    room.archive.splice(archiveIdx, 1);

    // joinedAt levemente anterior ao mais antigo já na fila garante que este
    // ticket fique na frente de todos os outros DENTRO da própria prioridade —
    // sem violar o algoritmo (um ticket de emergência ainda vem antes).
    const earliest = room.queue.length > 0 ? Math.min(...room.queue.map((t) => t.joinedAt)) : Date.now();

    ticket.status = "waiting";
    ticket.joinedAt = earliest - 1;
    ticket.calledAt = null;
    ticket.servedAt = null;
    ticket.removedAt = null;
    ticket.leftAt = null;
    ticket.counter = null;
    pushTimeline(ticket, "readmitted_to_queue");

    room.queue.push(ticket);
    recalcPositions(room.queue);
    logAction(room, actor, "ticket.readmitted_queue", { token, name: ticket.name });
    return { mode, ticket };
  }

  throw new Error("Modo de recall inválido. Use 'counter' ou 'queue_front'.");
};

/** Altera o peso de prioridade de um ticket já na fila. */
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

/** Retorna snapshot atual da fila de espera de uma sala. */
const getQueue = (roomCode) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");
  return room.queue;
};

/** Retorna o arquivo do dia — todos os tickets que já saíram da fila ativa. */
const getArchive = (roomCode) => {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Sala não encontrada.");
  return room.archive;
};

module.exports = {
  joinQueue,
  callNext,
  callSpecific,
  confirmServed,
  removeTicket,
  leaveQueue,
  recallTicket,
  changePriority,
  getQueue,
  getArchive,
};
