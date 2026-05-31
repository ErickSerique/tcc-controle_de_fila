/**
 * __tests__/queueService.test.js
 *
 * Testes unitários para a lógica de fila.
 * Usa mocks para isolar do banco de dados e Redis.
 */

// ── Mocks ──────────────────────────────────────────────────────────
const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
jest.mock("../config/db", () => ({
  pool: { query: (...args) => mockQuery(...args) },
}));

// Mock do roomService — cache em memória para testes
const mockQueues = {};
const mockRooms = {
  TEST01: {
    id: "room-uuid-1",
    code: "TEST01",
    org_id: "org-uuid-1",
    active: true,
    categories: [
      { name: "Geral", priority: 1, tma: 10 },
      { name: "Prioritário", priority: 3, tma: 5 },
    ],
  },
};

jest.mock("../services/roomService", () => ({
  getCachedQueue: jest.fn(async (code) => mockQueues[code] || []),
  cacheQueue: jest.fn(async (code, queue) => { mockQueues[code] = queue; }),
  getRoom: jest.fn(async (code) => mockRooms[code] || null),
  recalcPositions: jest.fn((queue) => {
    queue.sort((a, b) => b.priority - a.priority || a.joinedAt - b.joinedAt);
    queue.forEach((t, i) => {
      t.position = i + 1;
      t.estimatedWait = t.position * t.tma;
    });
  }),
  roomExists: jest.fn(async (code) => !!mockRooms[code]),
}));

// ── Import do service (após mocks) ────────────────────────────────
const {
  joinQueue,
  callNext,
  callSpecific,
  removeTicket,
  changePriority,
  getQueue,
  confirmServed,
} = require("../services/queueService");

// ── Helpers ────────────────────────────────────────────────────────
beforeEach(() => {
  // Limpa filas e mocks entre testes
  Object.keys(mockQueues).forEach((k) => delete mockQueues[k]);
  mockQuery.mockClear();
});

// ── Testes ─────────────────────────────────────────────────────────

describe("joinQueue", () => {
  test("adiciona um ticket à fila com posição correta", async () => {
    const ticket = await joinQueue("TEST01", { name: "João", category: "Geral" });

    expect(ticket.name).toBe("João");
    expect(ticket.category).toBe("Geral");
    expect(ticket.priority).toBe(1);
    expect(ticket.status).toBe("waiting");
    expect(ticket.position).toBe(1);
    expect(ticket.manual).toBe(false);
    expect(ticket.token).toContain("TEST01-");
  });

  test("respeita ordem de prioridade", async () => {
    const t1 = await joinQueue("TEST01", { name: "Normal", category: "Geral" });
    const t2 = await joinQueue("TEST01", { name: "Urgente", category: "Prioritário" });

    const queue = mockQueues["TEST01"];
    expect(queue[0].name).toBe("Urgente");  // prioridade 3 vem primeiro
    expect(queue[1].name).toBe("Normal");
    expect(queue[0].position).toBe(1);
    expect(queue[1].position).toBe(2);
  });

  test("rejeita categoria inexistente", async () => {
    await expect(
      joinQueue("TEST01", { name: "Teste", category: "Inventada" })
    ).rejects.toThrow('Categoria "Inventada" não existe nesta sala.');
  });

  test("rejeita sala inexistente", async () => {
    await expect(
      joinQueue("NAOEXISTE", { name: "Teste", category: "Geral" })
    ).rejects.toThrow("Sala inativa ou inexistente.");
  });

  test("marca ticket manual corretamente", async () => {
    const ticket = await joinQueue("TEST01", { name: "Manual", category: "Geral", manual: true });
    expect(ticket.manual).toBe(true);
  });

  test("limita nome a 80 caracteres", async () => {
    const longName = "A".repeat(100);
    const ticket = await joinQueue("TEST01", { name: longName, category: "Geral" });
    expect(ticket.name.length).toBe(80);
  });
});

describe("callNext", () => {
  test("remove o ticket de maior prioridade da fila", async () => {
    await joinQueue("TEST01", { name: "Normal", category: "Geral" });
    await joinQueue("TEST01", { name: "Urgente", category: "Prioritário" });

    const called = await callNext("TEST01");
    expect(called.name).toBe("Urgente");
    expect(called.status).toBe("called");
    expect(called.calledAt).toBeDefined();

    const queue = mockQueues["TEST01"];
    expect(queue.length).toBe(1);
    expect(queue[0].name).toBe("Normal");
  });

  test("retorna null se fila vazia", async () => {
    const result = await callNext("TEST01");
    expect(result).toBeNull();
  });
});

describe("callSpecific", () => {
  test("chama ticket específico pelo token", async () => {
    const t1 = await joinQueue("TEST01", { name: "Primeiro", category: "Geral" });
    const t2 = await joinQueue("TEST01", { name: "Segundo", category: "Geral" });

    const called = await callSpecific("TEST01", t2.token);
    expect(called.name).toBe("Segundo");
    expect(called.status).toBe("called");

    const queue = mockQueues["TEST01"];
    expect(queue.length).toBe(1);
    expect(queue[0].name).toBe("Primeiro");
  });

  test("rejeita token inexistente", async () => {
    await joinQueue("TEST01", { name: "Alguém", category: "Geral" });
    await expect(
      callSpecific("TEST01", "token-fake")
    ).rejects.toThrow("Ticket não encontrado na fila.");
  });
});

describe("removeTicket", () => {
  test("remove ticket e recalcula posições", async () => {
    const t1 = await joinQueue("TEST01", { name: "A", category: "Geral" });
    const t2 = await joinQueue("TEST01", { name: "B", category: "Geral" });

    const updated = await removeTicket("TEST01", t1.token);
    expect(updated.length).toBe(1);
    expect(updated[0].name).toBe("B");
    expect(updated[0].position).toBe(1);
  });

  test("persiste como abandoned no banco", async () => {
    const t1 = await joinQueue("TEST01", { name: "Removido", category: "Geral" });
    await removeTicket("TEST01", t1.token);

    // Verifica que a query de UPDATE usou 'abandoned'
    const updateCalls = mockQuery.mock.calls.filter((c) =>
      typeof c[0] === "string" && c[0].includes("abandoned")
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  test("rejeita token inexistente", async () => {
    await expect(
      removeTicket("TEST01", "token-fake")
    ).rejects.toThrow("Ticket não encontrado na fila.");
  });
});

describe("changePriority", () => {
  test("altera prioridade e reordena", async () => {
    const t1 = await joinQueue("TEST01", { name: "Normal", category: "Geral" });    // prio 1
    const t2 = await joinQueue("TEST01", { name: "Outro", category: "Geral" });     // prio 1

    const queue = await changePriority("TEST01", t2.token, 3);
    expect(queue[0].name).toBe("Outro");   // agora com prioridade 3, vem primeiro
    expect(queue[0].priority).toBe(3);
  });

  test("rejeita prioridade inválida", async () => {
    const t = await joinQueue("TEST01", { name: "X", category: "Geral" });
    await expect(
      changePriority("TEST01", t.token, 5)
    ).rejects.toThrow("Prioridade inválida. Use 1, 2 ou 3.");
  });
});

describe("confirmServed", () => {
  test("confirma atendimento quando ticket está no banco com status called", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await expect(confirmServed("some-token")).resolves.toBeUndefined();
  });

  test("rejeita quando ticket não encontrado", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(confirmServed("fake-token")).rejects.toThrow(
      "Ticket não encontrado ou já finalizado."
    );
  });
});
