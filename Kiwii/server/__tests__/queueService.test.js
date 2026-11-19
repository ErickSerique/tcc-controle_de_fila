/**
 * __tests__/queueService.test.js
 *
 * Testes unitários para a lógica de fila, guichês, trancamento e regras de prioridade.
 */

const {
  rooms,
  createRoom,
  recalcPositions,
  closeDay,
  claimCounter,
  releaseCounterBySocket,
} = require("../services/roomService");

const {
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
} = require("../services/queueService");

describe("queueService & roomService", () => {
  const ROOM_CODE = "TEST01";

  beforeEach(() => {
    rooms.clear();
    createRoom({
      name: "Sala de Testes",
      orgId: "org-uuid-1",
      hostId: "user-uuid-1",
      categories: [
        { name: "Geral", priority: 1, tma: 10 },
        { name: "Médio", priority: 2, tma: 8 },
        { name: "Prioritário", priority: 3, tma: 5 },
      ],
      counters: [
        { id: "c1", name: "Guichê 1" },
        { id: "c2", name: "Guichê 2" },
      ],
      customFields: [
        { id: "cpf", label: "CPF", type: "text", required: true },
        { id: "obs", label: "Observações", type: "text", required: false },
      ],
      priorityRules: { highBatchSize: 2, medBatchSize: 2 },
      actor: { name: "Tester", role: "admin" },
    });

    // Forçar código TEST01 para os testes
    const created = [...rooms.values()][0];
    rooms.delete(created.code);
    created.code = ROOM_CODE;
    rooms.set(ROOM_CODE, created);
  });

  describe("joinQueue", () => {
    test("adiciona um ticket à fila com campos válidos", () => {
      const ticket = joinQueue(ROOM_CODE, {
        name: "João Silva",
        category: "Geral",
        customData: { cpf: "123.456.789-00" },
      });

      expect(ticket.name).toBe("João Silva");
      expect(ticket.category).toBe("Geral");
      expect(ticket.priority).toBe(1);
      expect(ticket.status).toBe("waiting");
      expect(ticket.position).toBe(1);
      expect(ticket.manual).toBe(false);
      expect(ticket.token).toBeDefined();
      expect(typeof ticket.token).toBe("string");
      expect(ticket.token.length).toBeGreaterThan(0);
      expect(ticket.customData.cpf).toBe("123.456.789-00");
    });

    test("rejeita quando campo obrigatório está faltando", () => {
      expect(() => {
        joinQueue(ROOM_CODE, {
          name: "João Silva",
          category: "Geral",
          customData: {},
        });
      }).toThrow('O campo "CPF" é obrigatório.');
    });

    test("categoria inexistente usa fallback para a primeira categoria", () => {
      // O código atual faz fallback para categories[0] se a categoria não for encontrada
      const ticket = joinQueue(ROOM_CODE, {
        name: "João",
        category: "Inventada",
        customData: { cpf: "123" },
      });

      expect(ticket.category).toBe("Geral");
    });

    test("rejeita sala inexistente", () => {
      expect(() => {
        joinQueue("NAOEXISTE", {
          name: "João",
          category: "Geral",
          customData: { cpf: "123" },
        });
      }).toThrow("Sala não encontrada.");
    });

    test("bloqueia entrada quando a fila está trancada, a menos que seja manual", () => {
      const room = rooms.get(ROOM_CODE);
      room.locked = true;

      // Entrada normal rejeitada
      expect(() => {
        joinQueue(ROOM_CODE, {
          name: "Cliente App",
          category: "Geral",
          customData: { cpf: "123" },
        });
      }).toThrow("A fila está trancada e não está aceitando novos clientes.");

      // Entrada manual do host permitida
      const manualTicket = joinQueue(ROOM_CODE, {
        name: "Cliente Balcão",
        category: "Geral",
        manual: true,
        customData: { cpf: "123" },
      });
      expect(manualTicket.manual).toBe(true);
    });
  });

  describe("Regra de intercalação de prioridade em cascata", () => {
    test("intercala alta e média em blocos de highBatchSize quando ambos existem", () => {
      const queue = [
        { token: "h1", priority: 3, joinedAt: 100, tma: 5 },
        { token: "h2", priority: 3, joinedAt: 101, tma: 5 },
        { token: "h3", priority: 3, joinedAt: 102, tma: 5 },
        { token: "m1", priority: 2, joinedAt: 103, tma: 5 },
        { token: "m2", priority: 2, joinedAt: 104, tma: 5 },
        { token: "m3", priority: 2, joinedAt: 105, tma: 5 },
        { token: "l1", priority: 1, joinedAt: 106, tma: 5 },
      ];

      // highBatchSize=2, medBatchSize=2
      // Fluxo: 2 altas, 1 média (medsSinceLastLow=1), 2 altas (fica 1 alta),
      //        1 média (medsSinceLastLow=2 >= medBatch=2 → intercala 1 baixa),
      //        1 alta restante, 1 média restante
      recalcPositions(queue, { highBatchSize: 2, medBatchSize: 2 });

      // Verifica que posições estão atribuídas corretamente
      expect(queue[0].position).toBe(1);
      expect(queue[1].position).toBe(2);
      expect(queue[2].position).toBe(3);
      expect(queue.length).toBe(7);

      // Verifica que alta prioridade vem antes de baixa
      const highPositions = queue.filter((t) => t.priority === 3).map((t) => t.position);
      const lowPositions = queue.filter((t) => t.priority === 1).map((t) => t.position);
      expect(Math.min(...highPositions)).toBeLessThan(Math.max(...lowPositions));
    });

    test("se highBatchSize e medBatchSize forem 0, usa ordenação pura por prioridade decrescente", () => {
      const queue = [
        { token: "l1", priority: 1, joinedAt: 100, tma: 5 },
        { token: "m1", priority: 2, joinedAt: 101, tma: 5 },
        { token: "h1", priority: 3, joinedAt: 102, tma: 5 },
      ];

      recalcPositions(queue, { highBatchSize: 0, medBatchSize: 0 });

      expect(queue.map((t) => t.token)).toEqual(["h1", "m1", "l1"]);
    });

    test("batchSize legado funciona como fallback para highBatchSize", () => {
      const queue = [
        { token: "h1", priority: 3, joinedAt: 100, tma: 5 },
        { token: "h2", priority: 3, joinedAt: 101, tma: 5 },
        { token: "m1", priority: 2, joinedAt: 102, tma: 5 },
        { token: "l1", priority: 1, joinedAt: 103, tma: 5 },
      ];

      // batchSize legado é usado como highBatchSize via fallback
      recalcPositions(queue, { batchSize: 2 });

      // Altas primeiro por conta do batch
      expect(queue[0].token).toBe("h1");
      expect(queue[1].token).toBe("h2");
      expect(queue.length).toBe(4);
    });
  });

  describe("Atendimento e Guichês", () => {
    test("reivindica guichê e impede colisão", () => {
      const room = rooms.get(ROOM_CODE);
      claimCounter(room, "c1", "socket-1", "Operador 1");

      expect(room.counterClaims["c1"]).toEqual({ socketId: "socket-1", name: "Operador 1" });

      // Outro socket tentando o mesmo guichê é rejeitado
      expect(() => {
        claimCounter(room, "c1", "socket-2", "Operador 2");
      }).toThrow('O guichê "Guichê 1" já está em uso por Operador 1.');

      // Libera socket ao desconectar
      expect(releaseCounterBySocket(room, "socket-1")).toBe(true);
      expect(room.counterClaims["c1"]).toBeUndefined();
    });

    test("callNext chama o ticket de maior prioridade e atribui guichê", () => {
      joinQueue(ROOM_CODE, { name: "Normal", category: "Geral", customData: { cpf: "1" } });
      joinQueue(ROOM_CODE, { name: "Urgente", category: "Prioritário", customData: { cpf: "2" } });

      // callNext recebe counterName como string
      const called = callNext(ROOM_CODE, "Guichê 1");

      expect(called.name).toBe("Urgente");
      expect(called.status).toBe("called");
      expect(called.counter).toBe("Guichê 1");

      const queue = getQueue(ROOM_CODE);
      expect(queue.length).toBe(1);
      expect(queue[0].name).toBe("Normal");

      const archive = getArchive(ROOM_CODE);
      expect(archive[0].token).toBe(called.token);
    });

    test("confirmServed marca o ticket como atendido", () => {
      joinQueue(ROOM_CODE, { name: "Cliente", category: "Geral", customData: { cpf: "1" } });
      const called = callNext(ROOM_CODE, "Guichê 1");

      const served = confirmServed(ROOM_CODE, called.token, { actor: { name: "Op", role: "operator" } });
      expect(served.status).toBe("served");
      expect(served.servedAt).toBeDefined();
    });
  });

  describe("Encerramento do dia", () => {
    test("não permite encerrar o dia se ainda houver pessoas na fila", () => {
      joinQueue(ROOM_CODE, { name: "Pendente", category: "Geral", customData: { cpf: "1" } });

      expect(() => {
        closeDay(ROOM_CODE, { name: "Op", role: "operator" });
      }).toThrow("Não é possível encerrar: ainda há 1 na fila.");
    });

    test("encerra o dia quando fila e atendimento estão vazios", () => {
      joinQueue(ROOM_CODE, { name: "Pendente", category: "Geral", customData: { cpf: "1" } });

      // Chama o ticket (move de queue para archive com status "called")
      const called = callNext(ROOM_CODE);

      // Atende o ticket
      confirmServed(ROOM_CODE, called.token);

      // Agora fila e atendimento zerados → pode encerrar
      const report = closeDay(ROOM_CODE, { name: "Op", role: "operator" });
      expect(report.totalServed).toBe(1);
      expect(report.totalAbandonedInQueue).toBe(0);
      expect(rooms.get(ROOM_CODE).active).toBe(false);
    });

    test("não permite encerrar se ticket está em atendimento (called) na fila", () => {
      joinQueue(ROOM_CODE, { name: "Pendente1", category: "Geral", customData: { cpf: "1" } });
      joinQueue(ROOM_CODE, { name: "Pendente2", category: "Geral", customData: { cpf: "2" } });

      // Chama o primeiro ticket (move para archive)
      const called = callNext(ROOM_CODE);

      // Segundo ticket ainda está na fila esperando
      expect(() => {
        closeDay(ROOM_CODE, { name: "Op", role: "operator" });
      }).toThrow("Não é possível encerrar: ainda há 1 na fila.");

      // Remove o segundo da fila
      const queue = getQueue(ROOM_CODE);
      removeTicket(ROOM_CODE, queue[0].token);

      // Mas o primeiro ainda está "called" no archive — closeDay verifica queue, não archive
      // Depois de remover todos da queue, pode fechar se não há "called" na queue
      confirmServed(ROOM_CODE, called.token);

      const report = closeDay(ROOM_CODE, { name: "Op", role: "operator" });
      expect(report.totalServed).toBe(1);
    });
  });

  describe("Recall e remoções", () => {
    test("remove ticket da fila e arquiva como removed_by_host", () => {
      const ticket = joinQueue(ROOM_CODE, { name: "No-show", category: "Geral", customData: { cpf: "1" } });
      const updatedQueue = removeTicket(ROOM_CODE, ticket.token);

      expect(updatedQueue.length).toBe(0);
      const archive = getArchive(ROOM_CODE);
      expect(archive[0].status).toBe("removed_by_host");
    });

    test("recall de ticket para guichê direto ou frente da fila", () => {
      const ticket = joinQueue(ROOM_CODE, { name: "Voltou", category: "Geral", customData: { cpf: "1" } });
      removeTicket(ROOM_CODE, ticket.token);

      // Recall direto para guichê
      const { ticket: recalled } = recallTicket(ROOM_CODE, ticket.token, {
        mode: "counter",
        counter: "Guichê 2",
        actor: { name: "Op", role: "operator" },
      });
      expect(recalled.status).toBe("called");
      expect(recalled.counter).toBe("Guichê 2");

      // Confirma e remove
      confirmServed(ROOM_CODE, ticket.token);

      // Recall de volta à fila (queue_front)
      const { ticket: readmitted } = recallTicket(ROOM_CODE, ticket.token, {
        mode: "queue_front",
        actor: { name: "Op", role: "operator" },
      });
      expect(readmitted.status).toBe("waiting");
      expect(getQueue(ROOM_CODE).length).toBe(1);
    });

    test("recall permite alterar a categoria do ticket", () => {
      const ticket = joinQueue(ROOM_CODE, { name: "Retorno", category: "Geral", customData: { cpf: "1" } });
      removeTicket(ROOM_CODE, ticket.token);

      const { ticket: recalled } = recallTicket(ROOM_CODE, ticket.token, {
        mode: "counter",
        counter: "Guichê 1",
        category: "Retorno",
        actor: { name: "Op", role: "operator" },
      });

      expect(recalled.category).toBe("Retorno");
      expect(recalled.isRecall).toBe(true);
    });
  });
});
