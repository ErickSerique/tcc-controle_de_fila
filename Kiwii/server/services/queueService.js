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
 *   waiting → called → served
 *           ↘ removed_by_host   (host removeu)
 *           ↘ left_voluntarily  (cliente saiu pelo próprio celular)
 */

// ── Regras de Prioridade Automática (M5) ─────────────────────────
const evaluateAutoPriority = (customData = {}, rules = [], basePriority = 1) => {
  if (!rules || rules.length === 0) return basePriority;
  for (const rule of rules) {
    const val = customData[rule.fieldId || rule.field];
    if (val === undefined || val === null || val === "") continue;

    const op = rule.operator || rule.op || "==";
    const target = rule.value;
    let match = false;

    if (op === ">=" || op === "gte") {
      match = parseFloat(val) >= parseFloat(target);
    } else if (op === ">" || op === "gt") {
      match = parseFloat(val) > parseFloat(target);
    } else if (op === "<=" || op === "lte") {
      match = parseFloat(val) <= parseFloat(target);
    } else if (op === "<" || op === "lt") {
      match = parseFloat(val) < parseFloat(target);
    } else if (op === "==" || op === "eq") {
      match = String(val).toLowerCase() === String(target).toLowerCase();
    } else if (op === "contains") {
      match = String(val).toLowerCase().includes(String(target).toLowerCase());
    }

    if (match) {
      return rule.priority || 3;
    }
  }
  return basePriority;
};

const pushTimeline = (ticket, event, details = {}) => {
  if (!ticket.timeline) ticket.timeline = [];
  ticket.timeline.push({ at: Date.now(), event, ...details });
};

const buildCustomDataEntries = (roomCustomFields, customData) => {
  if (!Array.isArray(roomCustomFields) || !customData) return [];
  return roomCustomFields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    value: customData[field.id] ?? null,
  }));
};

/** Adiciona um ticket à fila com validação de campos personalizados e trancamento. */
const joinQueue = (roomCode, { name, category, manual = false, customData = {}, priority: manualPriority }) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");
  if (!room.active) throw new Error("Esta sala já foi encerrada.");

  // Fila trancada (Priority 8) — manual pelo staff continua permitido
  if (room.locked && !manual) {
    throw new Error("A fila está trancada e não está aceitando novos clientes.");
  }

  const cleanName = name?.toString().trim();
  if (!cleanName || cleanName.length < 2) {
    throw new Error("Nome deve ter pelo menos 2 caracteres.");
  }

  const catConfig = room.categories.find((c) => c.name === category) || room.categories[0];
  if (!catConfig) throw new Error("Categoria inválida.");

  // Validação dos campos obrigatórios configurados pelo host
  for (const field of room.customFields || []) {
    if (field.required) {
      const val = customData[field.id];
      if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
        throw new Error(`O campo "${field.label}" é obrigatório.`);
      }
    }
  }

  // Avaliação de prioridade automática (M5)
  const autoPriority = evaluateAutoPriority(
    customData,
    room.priorityRules || room.priority_rules || [],
    catConfig.priority
  );
  const effectivePriority = manualPriority ? manualPriority : autoPriority;

  // Letra identificadora por prioridade: A = Alta (3), B = Média (2), C = Baixa (1)
  const prefix = effectivePriority === 3 ? "A" : effectivePriority === 2 ? "B" : "C";
  const samePriorityCount =
    room.queue.filter((t) => t.priority === effectivePriority).length +
    room.archive.filter((t) => t.priority === effectivePriority).length;
  const code = `${prefix}${String(samePriorityCount + 1).padStart(3, "0")}`;

  const ticket = {
    id: uuidv4(),
    token: uuidv4().replace(/-/g, "").slice(0, 16),
    code,
    name: cleanName,
    category: catConfig.name,
    priority: effectivePriority,
    tma: catConfig.tma,
    status: "waiting",
    joinedAt: Date.now(),
    calledAt: null,
    servedAt: null,
    removedAt: null,
    leftAt: null,
    counter: null,
    manual: !!manual,
    customData,
    customDataEntries: buildCustomDataEntries(room.customFields, customData),
    position: 0,
    estimatedWait: 0,
    timeline: [],
  };

  pushTimeline(ticket, "joined", { category: catConfig.name, priority: effectivePriority });
  room.queue.push(ticket);
  recalcPositions(room.queue, room.priorityRule);
  logAction(room, { name: cleanName, role: manual ? "operator" : "client" }, "ticket.joined", {
    code: ticket.code,
    category: ticket.category,
    priority: ticket.priority,
  });

  return ticket;
};

/** Chama o próximo ticket da fila ativa para o guichê especificado. */
const callNext = (roomCode, counterName) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");
  if (room.queue.length === 0) return null;

  const ticket = room.queue.shift();
  ticket.status = "called";
  ticket.calledAt = Date.now();
  ticket.counter = counterName || room.counters[0]?.name || "Guichê Único";
  pushTimeline(ticket, "called", { counter: ticket.counter });

  room.archive.push(ticket);
  recalcPositions(room.queue, room.priorityRule);
  logAction(room, { name: ticket.counter, role: "operator" }, "ticket.called", {
    token: ticket.token,
    name: ticket.name,
    counter: ticket.counter,
  });

  return ticket;
};

/** Chama um ticket específico que ainda está na fila de espera. */
const callSpecific = (roomCode, token, counterName) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");

  const idx = room.queue.findIndex((t) => t.token === token);
  if (idx === -1) throw new Error("Ticket não encontrado na fila de espera.");

  const [ticket] = room.queue.splice(idx, 1);
  ticket.status = "called";
  ticket.calledAt = Date.now();
  ticket.counter = counterName || room.counters[0]?.name || "Guichê Único";
  pushTimeline(ticket, "called", { counter: ticket.counter });

  room.archive.push(ticket);
  recalcPositions(room.queue, room.priorityRule);
  logAction(room, { name: ticket.counter, role: "operator" }, "ticket.called_specific", {
    token: ticket.token,
    name: ticket.name,
    counter: ticket.counter,
  });

  return ticket;
};

/** Confirma que o atendimento de um ticket chamado foi concluído. */
const confirmServed = (roomCode, token, { actor } = {}) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");

  let ticket = room.archive.find((t) => t.token === token);
  if (!ticket) {
    const idx = room.queue.findIndex((t) => t.token === token);
    if (idx !== -1) {
      ticket = room.queue.splice(idx, 1)[0];
      room.archive.push(ticket);
    }
  }

  if (!ticket) throw new Error("Ticket não encontrado.");

  ticket.status = "served";
  ticket.servedAt = Date.now();
  pushTimeline(ticket, "served", { actor: actor?.name });
  logAction(room, actor, "ticket.served", { token, name: ticket.name });
  return ticket;
};

/** Host remove um ticket da fila (não compareceu, desistiu, etc.). */
const removeTicket = (roomCode, token, actor) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");

  const idx = room.queue.findIndex((t) => t.token === token);
  if (idx === -1) {
    const archived = room.archive.find((t) => t.token === token);
    if (archived) {
      archived.status = "removed_by_host";
      archived.removedAt = Date.now();
      pushTimeline(ticket, "removed_by_host");
      logAction(room, actor, "ticket.removed", { token, name: archived.name });
      return room.queue;
    }
    throw new Error("Ticket não encontrado na fila.");
  }

  const [ticket] = room.queue.splice(idx, 1);
  ticket.status = "removed_by_host";
  ticket.removedAt = Date.now();
  pushTimeline(ticket, "removed_by_host");
  room.archive.push(ticket);
  recalcPositions(room.queue, room.priorityRule);
  logAction(room, actor, "ticket.removed", { token, name: ticket.name });
  return room.queue;
};

/** Cliente desiste e sai voluntariamente da fila pelo próprio dispositivo. */
const leaveQueue = (roomCode, token) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");

  const idx = room.queue.findIndex((t) => t.token === token);
  if (idx === -1) throw new Error("Ticket não encontrado na fila.");

  const [ticket] = room.queue.splice(idx, 1);
  ticket.status = "left_voluntarily";
  ticket.leftAt = Date.now();
  pushTimeline(ticket, "left_voluntarily");
  room.archive.push(ticket);
  recalcPositions(room.queue, room.priorityRule);
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
const recallTicket = (roomCode, token, { mode = "counter", counter, actor } = {}) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
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
    if (archiveIdx !== -1) {
      room.archive.splice(archiveIdx, 1);
    }

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
    recalcPositions(room.queue, room.priorityRule);
    logAction(room, actor, "ticket.readmitted_queue", { token, name: ticket.name });
    return { mode, ticket };
  }

  throw new Error("Modo de recall inválido. Use 'counter' ou 'queue_front'.");
};

/** Altera o peso de prioridade de um ticket já na fila. */
const changePriority = (roomCode, token, newPriority) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");
  if (![1, 2, 3].includes(newPriority)) throw new Error("Prioridade inválida. Use 1, 2 ou 3.");

  const ticket = room.queue.find((t) => t.token === token);
  if (!ticket) throw new Error("Ticket não encontrado na fila.");

  ticket.priority = newPriority;
  recalcPositions(room.queue, room.priorityRule);
  return room.queue;
};

/** Retorna snapshot atual da fila de espera de uma sala. */
const getQueue = (roomCode) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
  if (!room) throw new Error("Sala não encontrada.");
  return room.queue;
};

/** Retorna o arquivo do dia — todos os tickets que já saíram da fila ativa. */
const getArchive = (roomCode) => {
  const room = rooms.get(roomCode?.toString().trim().toUpperCase());
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
  evaluateAutoPriority,
};
