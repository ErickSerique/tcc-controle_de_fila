/**
 * __tests__/auth.test.js
 *
 * Testes unitários para o middleware de autenticação.
 * Verifica o fluxo Supabase → fallback JWT local.
 */

// ── Mocks ──────────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockVerifySupabase = jest.fn();

jest.mock("../config/db", () => ({
  pool: { query: (...args) => mockQuery(...args) },
  verifySupabaseToken: (...args) => mockVerifySupabase(...args),
}));

jest.mock("../config", () => ({
  JWT_SECRET: "test_secret_key_for_unit_tests",
  JWT_EXPIRES_IN: "8h",
  NODE_ENV: "test",
}));

// ── Import (após mocks) ───────────────────────────────────────────
const { requireAuth, issueLocalSession, verifyLocalSession } = require("../middleware/auth");

// ── Helpers ────────────────────────────────────────────────────────
const mockReq = (token) => ({
  headers: { authorization: token ? `Bearer ${token}` : undefined },
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

beforeEach(() => {
  mockQuery.mockClear();
  mockVerifySupabase.mockClear();
  mockNext.mockClear();
});

// ── Testes: JWT Local ─────────────────────────────────────────────

describe("issueLocalSession / verifyLocalSession", () => {
  test("emite e verifica um JWT local válido", () => {
    const token = issueLocalSession("user-123", "host@clinica.com");
    const user = verifyLocalSession(token);

    expect(user.id).toBe("user-123");
    expect(user.email).toBe("host@clinica.com");
  });

  test("rejeita token com type errado", () => {
    const jwt = require("jsonwebtoken");
    const badToken = jwt.sign(
      { sub: "user-123", email: "x@x.com", type: "wrong_type" },
      "test_secret_key_for_unit_tests"
    );

    expect(() => verifyLocalSession(badToken)).toThrow("Token não é uma sessão local.");
  });

  test("rejeita token expirado", () => {
    const jwt = require("jsonwebtoken");
    const expired = jwt.sign(
      { sub: "user-123", email: "x@x.com", type: "local_session" },
      "test_secret_key_for_unit_tests",
      { expiresIn: "-1s" } // já expirado
    );

    expect(() => verifyLocalSession(expired)).toThrow();
  });
});

// ── Testes: requireAuth middleware ────────────────────────────────

describe("requireAuth", () => {
  test("retorna 401 se não houver header Authorization", async () => {
    const req = mockReq(null);
    const res = mockRes();

    await requireAuth(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("autentica via Supabase quando disponível", async () => {
    mockVerifySupabase.mockResolvedValue({ id: "sup-user", email: "a@b.com" });
    mockQuery.mockResolvedValue({ rows: [{ id: "sup-user", name: "Host" }] });

    const req = mockReq("supabase-token");
    const res = mockRes();

    await requireAuth(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user.id).toBe("sup-user");
    expect(req.authMode).toBe("supabase");
    expect(req.profile).toEqual({ id: "sup-user", name: "Host" });
  });

  test("faz fallback para JWT local quando Supabase falha", async () => {
    mockVerifySupabase.mockRejectedValue(new Error("Supabase offline"));
    mockQuery.mockResolvedValue({ rows: [{ id: "local-user", name: "Host Local" }] });

    const localToken = issueLocalSession("local-user", "host@local.com");
    const req = mockReq(localToken);
    const res = mockRes();

    await requireAuth(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.user.id).toBe("local-user");
    expect(req.authMode).toBe("local");
  });

  test("retorna 401 quando ambos falham", async () => {
    mockVerifySupabase.mockRejectedValue(new Error("Supabase offline"));

    const req = mockReq("token-invalido-qualquer");
    const res = mockRes();

    await requireAuth(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("continua mesmo se perfil do banco falhar (graceful)", async () => {
    mockVerifySupabase.mockResolvedValue({ id: "user-x", email: "x@x.com" });
    mockQuery.mockRejectedValue(new Error("DB offline"));

    const req = mockReq("valid-token");
    const res = mockRes();

    await requireAuth(req, res, mockNext);

    // Deve continuar com profile = null, sem crash
    expect(mockNext).toHaveBeenCalled();
    expect(req.user.id).toBe("user-x");
    expect(req.profile).toBeNull();
  });
});
