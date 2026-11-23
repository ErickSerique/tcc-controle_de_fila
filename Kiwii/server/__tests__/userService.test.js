const mockClientQuery = jest.fn();
const mockPoolQuery = jest.fn();
const mockConnect = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock("../config/db", () => ({
  pool: {
    query: (...args) => mockPoolQuery(...args),
    connect: () => mockConnect(),
  },
  supabase: {
    auth: {
      admin: {
        deleteUser: (...args) => mockDeleteUser(...args),
      },
    },
  },
}));

const { updateProfile, deleteUserAccount } = require("../services/userService");

describe("userService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: jest.fn(),
    });
  });

  describe("updateProfile", () => {
    test("atualiza o perfil do usuário e retorna a linha atualizada", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: "user-1", name: "Novo Nome", avatar_url: null }],
      });

      const res = await updateProfile("user-1", { name: "Novo Nome" });
      expect(res.name).toBe("Novo Nome");
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO user_profiles"),
        ["user-1", "Novo Nome", null]
      );
    });
  });

  describe("deleteUserAccount", () => {
    test("impede exclusão se o usuário for o único admin de uma organização com outros membros", async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({});
      // Query 1: blockerOrgs
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: "org-1", name: "Clínica Saúde" }],
      });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({});

      await expect(deleteUserAccount("user-admin")).rejects.toThrow(
        /único Administrador da organização "Clínica Saúde"/
      );
      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    });

    test("exclui com sucesso usuário sem bloqueios", async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({});
      // Query 1: blockerOrgs -> empty
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // Query 2: soloOrgs -> empty
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // Query 3: delete invites
      mockClientQuery.mockResolvedValueOnce({});
      // Query 4: nullify opened_by
      mockClientQuery.mockResolvedValueOnce({});
      // Query 4b: nullify closed_by
      mockClientQuery.mockResolvedValueOnce({});
      // Query 5: nullify reports
      mockClientQuery.mockResolvedValueOnce({});
      // Query 6: delete org_members
      mockClientQuery.mockResolvedValueOnce({});
      // Query 7: delete user_profiles
      mockClientQuery.mockResolvedValueOnce({});
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({});
      // Supabase deleteUser
      mockDeleteUser.mockResolvedValueOnce({});

      const result = await deleteUserAccount("user-clean");
      expect(result.success).toBe(true);
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
      expect(mockDeleteUser).toHaveBeenCalledWith("user-clean");
    });
  });
});
