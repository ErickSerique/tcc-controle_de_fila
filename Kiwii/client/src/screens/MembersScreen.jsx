/**
 * screens/MembersScreen.jsx
 *
 * Kiwii Design System v3.0 — Gerenciamento de Membros e Convites
 * Suporta RBAC estrito (Admin/Operador) e link temporário de convite com fila de entrada.
 */
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Trash2,
  UserPlus,
  UserCheck,
  XCircle,
  Clock,
  Link,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  fetchOrgMembers,
  generateTempInviteLink,
  fetchJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  updateMemberRole,
  removeMember,
} from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";

const ROLE_LABELS = { owner: "Administrador", admin: "Administrador", operator: "Operador" };
const ROLE_COLORS = { owner: "var(--primary)", admin: "var(--primary)", operator: "var(--text-muted)" };

const MembersScreen = ({ onBack }) => {
  const { activeOrg, user } = useAuth();
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Convite temporário
  const [tempLink, setTempLink] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  const isAdmin = ["admin", "owner"].includes(activeOrg?.role);

  const loadData = async () => {
    if (!activeOrg) return;
    try {
      const membersData = await fetchOrgMembers(activeOrg.id);
      setMembers(membersData.members || []);

      if (isAdmin) {
        const requestsData = await fetchJoinRequests(activeOrg.id);
        setJoinRequests(requestsData.requests || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrg]);

  const handleGenerateTempLink = async (durationMinutes = 30) => {
    setGeneratingLink(true);
    setError("");
    setActionSuccess("");
    try {
      const res = await generateTempInviteLink(activeOrg.id, durationMinutes);
      setTempLink(res.link);
      setCopied(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyTempLink = () => {
    if (!tempLink) return;
    navigator.clipboard.writeText(tempLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleApprove = async (requestId, role) => {
    setProcessingRequestId(requestId);
    setError("");
    try {
      await approveJoinRequest(activeOrg.id, requestId, role);
      setActionSuccess(`Membro aprovado como ${ROLE_LABELS[role]}!`);
      setTimeout(() => setActionSuccess(""), 4000);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingRequestId(requestId);
    setError("");
    try {
      await rejectJoinRequest(activeOrg.id, requestId);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      await updateMemberRole(activeOrg.id, targetUserId, newRole);
      setMembers((m) =>
        m.map((mb) => (mb.user_id === targetUserId ? { ...mb, role: newRole } : mb))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmRemoveMember = async () => {
    if (!removeTarget) return;
    try {
      await removeMember(activeOrg.id, removeTarget.user_id);
      setMembers((m) => m.filter((mb) => mb.user_id !== removeTarget.user_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "24px",
        maxWidth: "680px",
        margin: "0 auto",
      }}
    >
      <div className="animate-fade">
        {/* Header */}
        <div style={{ paddingTop: "16px", marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="display" style={{ fontSize: "18px", fontWeight: 800 }}>
                Kiwi<span style={{ color: "var(--primary)" }}>i</span>
              </span>
              <span className="tag">{activeOrg?.name || "Organização"}</span>
            </div>
            <button className="btn" onClick={onBack} style={{ padding: "7px 14px", fontSize: "13px" }}>
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <h1 style={{ fontSize: "1.5rem" }}>Membros da Equipe</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
            Gere links temporários e aprove colaboradores na fila de entrada.
          </p>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--danger-glow)",
              border: "1px solid var(--danger)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {actionSuccess && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--primary-glow)",
              border: "1px solid var(--primary)",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "var(--primary)",
              fontSize: "13px",
              marginBottom: "20px",
            }}
          >
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} /> {actionSuccess}
          </div>
        )}

        {/* Gerador de Link Temporário (Prioridade 12) */}
        {isAdmin && (
          <div className="card" style={{ padding: "20px", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <Link size={16} color="var(--primary)" />
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
                Convidar Colaborador com Link Temporário
              </div>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
              Gere um link temporário (válido por 30 minutos). O colaborador acessa o link e solicita entrada; você aprova aqui o cargo dele.
            </p>

            <button
              onClick={() => handleGenerateTempLink(30)}
              disabled={generatingLink}
              className="btn btn-primary"
              style={{ padding: "10px 18px", fontWeight: 700, fontSize: "13px" }}
            >
              {generatingLink ? "Gerando..." : "Gerar Link de Convite Temporário (30 min)"}
            </button>

            {tempLink && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px",
                  borderRadius: "8px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                  Link gerado! Compartilhe com quem vai ingressar na equipe:
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    className="input mono"
                    readOnly
                    value={tempLink}
                    style={{ fontSize: "12px", background: "var(--bg)", color: "var(--text)" }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={copyTempLink}
                    style={{ padding: "8px 14px", whiteSpace: "nowrap", gap: "6px", fontWeight: 600 }}
                  >
                    {copied ? (
                      <>
                        <Check size={14} color="var(--primary)" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copiar Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fila de Entrada / Solicitações Pendentes (Prioridade 12) */}
        {isAdmin && joinRequests.length > 0 && (
          <div
            className="card"
            style={{
              padding: "20px",
              marginBottom: "28px",
              border: "1.5px solid var(--primary)",
              background: "var(--primary-glow)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Clock size={16} color="var(--primary)" />
              <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>
                Fila de Entrada — Solicitações Pendentes ({joinRequests.length})
              </div>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "16px" }}>
              Colaboradores que acessaram o link temporário e aguardam aprovação:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {joinRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
                      {req.user_name || req.user_email || "Usuário"}
                    </div>
                    {req.user_email && req.user_name && (
                      <div className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        {req.user_email}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                      Solicitado em {new Date(req.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleApprove(req.id, "operator")}
                      disabled={processingRequestId === req.id}
                      className="btn btn-secondary btn-sm"
                      style={{ fontWeight: 600, fontSize: "12px" }}
                    >
                      Aprovar como Operador
                    </button>
                    <button
                      onClick={() => handleApprove(req.id, "admin")}
                      disabled={processingRequestId === req.id}
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 700, fontSize: "12px" }}
                    >
                      Aprovar como Admin
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={processingRequestId === req.id}
                      className="btn btn-sm"
                      style={{ color: "var(--danger)", border: "1px solid var(--danger)", background: "transparent", fontSize: "12px" }}
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Membros Ativos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Membros Ativos ({members.length})
            </span>
          </div>

          {loading ? (
            <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              Carregando membros...
            </div>
          ) : members.length === 0 ? (
            <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              Nenhum membro encontrado.
            </div>
          ) : (
            (() => {
              const totalAdmins = members.filter((x) => x.role === "admin" || x.role === "owner").length;

              return members.map((m) => {
                const isSelf = m.user_id === user?.id;
                // Somente administradores podem trocar cargos
                const canEditThisMember = isAdmin;
                // O último administrador não pode rebaixar seu próprio cargo
                const isOnlyAdminSelf = isSelf && (m.role === "admin" || m.role === "owner") && totalAdmins <= 1;

                return (
                  <div
                    key={m.user_id}
                    className="card"
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: ROLE_COLORS[m.role] || "var(--primary)",
                        flexShrink: 0,
                      }}
                    >
                      <Shield size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "var(--text)",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.name || m.email}
                        </span>
                        {isSelf && (
                          <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            (você)
                          </span>
                        )}
                      </div>
                      {m.email && m.name && (
                        <div className="mono" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {m.email}
                        </div>
                      )}
                    </div>

                    {canEditThisMember ? (
                      isOnlyAdminSelf ? (
                        <span
                          className="tag"
                          style={{
                            color: "var(--primary)",
                            borderColor: "var(--primary)",
                            fontSize: "11px",
                            padding: "6px 12px",
                          }}
                          title="Você é o único Administrador da instituição e não pode alterar o próprio cargo."
                        >
                          Administrador (Único)
                        </span>
                      ) : (
                        <select
                          className="input"
                          value={m.role === "owner" ? "admin" : m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                          style={{ width: "140px", fontSize: "12px", padding: "6px 10px" }}
                        >
                          <option value="operator">Operador</option>
                          <option value="admin">Administrador</option>
                        </select>
                      )
                    ) : (
                      <span
                        className="tag"
                        style={{
                          color: ROLE_COLORS[m.role] || "var(--primary)",
                          borderColor: ROLE_COLORS[m.role] || "var(--primary)",
                          fontSize: "11px",
                        }}
                      >
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    )}

                    {isAdmin && !isSelf && (
                      <button
                        className="btn"
                        onClick={() => setRemoveTarget(m)}
                        style={{
                          padding: "8px",
                          color: "var(--danger)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                        }}
                        aria-label="Remover membro"
                        title="Remover da organização"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Modal de confirmação para remoção */}
        <ConfirmModal
          open={!!removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={confirmRemoveMember}
          title="Remover Membro"
          message={`Tem certeza que deseja remover ${
            removeTarget?.name || removeTarget?.email || "este membro"
          } da organização? O usuário perderá o acesso às salas da instituição.`}
          confirmText="Remover Membro"
          danger
        />
      </div>
    </div>
  );
};

export default MembersScreen;
