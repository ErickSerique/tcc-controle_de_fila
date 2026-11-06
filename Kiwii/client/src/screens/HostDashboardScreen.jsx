/**
 * screens/HostDashboardScreen.jsx
 *
 * Design System v3.0 — Dashboard do Host & Histórico de Dias Passados (M4/M6)
 * Exibe métricas consolidadas, histórico de sessões anteriores e reexportação de relatórios.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchHistory, fetchSessionReport } from "../lib/api";
import { exportToCSV, exportToJSON } from "../lib/export";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle,
  Clock,
  Download,
  Calendar,
  AlertTriangle,
  RotateCw,
  Eye,
  X,
  FileSpreadsheet,
  FileCode,
  Tag,
  Users,
} from "lucide-react";

const HostDashboardScreen = ({ onBack }) => {
  const { activeOrg } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadHistory = async () => {
    if (!activeOrg?.id) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchHistory(activeOrg.id);
      setHistory(data.history || []);
    } catch (err) {
      setError(err.message || "Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [activeOrg?.id]);

  const handleOpenDetails = async (sessionSummary) => {
    setLoadingSession(true);
    try {
      const data = await fetchSessionReport(activeOrg.id, sessionSummary.id);
      setSelectedSession(data.report || sessionSummary);
    } catch (err) {
      // Fallback para os dados já carregados no resumo
      setSelectedSession(sessionSummary);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleExportCSV = async (sessionSummary) => {
    try {
      let reportData = sessionSummary;
      if (!sessionSummary.tickets) {
        const data = await fetchSessionReport(activeOrg.id, sessionSummary.id);
        reportData = data.report || sessionSummary;
      }
      exportToCSV(reportData);
    } catch (err) {
      alert("Erro ao exportar CSV: " + err.message);
    }
  };

  const handleExportJSON = async (sessionSummary) => {
    try {
      let reportData = sessionSummary;
      if (!sessionSummary.tickets) {
        const data = await fetchSessionReport(activeOrg.id, sessionSummary.id);
        reportData = data.report || sessionSummary;
      }
      exportToJSON(reportData);
    } catch (err) {
      alert("Erro ao exportar JSON: " + err.message);
    }
  };

  // KPIs consolidados
  const totalServed = history.reduce((acc, h) => acc + (parseInt(h.total_served || h.totalServed || 0)), 0);
  const totalAbandoned = history.reduce((acc, h) => acc + (parseInt(h.total_abandoned || h.totalAbandoned || 0)), 0);
  const avgWait = history.length > 0
    ? (history.reduce((acc, h) => acc + (parseFloat(h.avg_wait_minutes || h.avgWaitMinutes || 0)), 0) / history.length).toFixed(1)
    : "0.0";

  const filteredHistory = history.filter((h) => {
    const term = searchTerm.toLowerCase();
    const name = (h.room_name || h.roomName || "").toLowerCase();
    const code = (h.room_code || h.roomCode || "").toLowerCase();
    return name.includes(term) || code.includes(term);
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "32px 24px",
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
      <div className="animate-fade">
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              onClick={onBack}
              className="btn btn-secondary"
              style={{ padding: "8px 12px", gap: "6px", fontSize: "13px" }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 800, margin: 0, fontFamily: "var(--font-display)" }}>
                  Dashboard & Histórico
                </h1>
                <span className="tag" style={{ textTransform: "uppercase" }}>
                  {activeOrg?.name}
                </span>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "4px 0 0" }}>
                Acompanhe o desempenho de sessões passadas e exporte relatórios consolidados.
              </p>
            </div>
          </div>

          <button
            onClick={loadHistory}
            className="btn btn-secondary"
            style={{ padding: "8px 14px", gap: "6px", fontSize: "13px" }}
            disabled={loading}
          >
            <RotateCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        {/* KPIs Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "32px",
          }}
        >
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                Total Atendidos
              </span>
              <div style={{ color: "var(--priority-low)", background: "rgba(52,211,153,0.12)", padding: "6px", borderRadius: "8px" }}>
                <CheckCircle size={18} />
              </div>
            </div>
            <div className="mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
              {totalServed}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
              Pacientes concluídos em todas as salas
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                Total Desistências
              </span>
              <div style={{ color: "var(--priority-high)", background: "rgba(248,113,113,0.12)", padding: "6px", borderRadius: "8px" }}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
              {totalAbandoned}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
              Removidos ou desistentes da fila
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                Tempo Médio de Espera
              </span>
              <div style={{ color: "var(--accent)", background: "var(--accent-muted)", padding: "6px", borderRadius: "8px" }}>
                <Clock size={18} />
              </div>
            </div>
            <div className="mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
              ~{avgWait} <span style={{ fontSize: "16px", fontWeight: 500 }}>min</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
              Média entre chamada e entrada
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                Sessões Fechadas
              </span>
              <div style={{ color: "var(--primary)", background: "var(--primary-muted)", padding: "6px", borderRadius: "8px" }}>
                <BarChart3 size={18} />
              </div>
            </div>
            <div className="mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
              {history.length}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
              Dias e turnos arquivados
            </div>
          </div>
        </div>

        {/* Busca e Lista de Sessões */}
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            Histórico de Sessões Anteriores
          </h2>
          <input
            className="input"
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: "260px", padding: "8px 12px", fontSize: "13px" }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-secondary)" }}>
            <RotateCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px" }}>Carregando histórico da instituição...</p>
          </div>
        ) : error ? (
          <div className="card" style={{ padding: "24px", textAlign: "center", borderColor: "rgba(248,113,113,0.3)" }}>
            <AlertTriangle size={24} style={{ color: "var(--priority-high)", margin: "0 auto 8px" }} />
            <p style={{ color: "var(--priority-high)", fontSize: "14px", margin: 0 }}>{error}</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--surface)",
              color: "var(--text-secondary)",
            }}
          >
            <Calendar size={36} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
              Nenhuma sessão arquivada
            </h3>
            <p style={{ fontSize: "13px", maxWidth: "420px", margin: "0 auto" }}>
              Quando você encerrar o dia de uma sala de atendimento, as métricas e relatórios completos aparecerão aqui.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredHistory.map((session, idx) => {
              const dateStr = session.generated_at
                ? new Date(session.generated_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : session.date || "Data não registrada";

              return (
                <div
                  key={session.id || idx}
                  className="card"
                  style={{
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "14px",
                    background: "var(--surface)",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "10px",
                        background: "var(--surface-hover)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--primary)",
                        flexShrink: 0,
                      }}
                    >
                      <Calendar size={20} />
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>
                          {session.room_name || session.roomName || "Sala de Atendimento"}
                        </span>
                        <span className="mono tag" style={{ fontSize: "11px", fontWeight: 700 }}>
                          #{session.room_code || session.roomCode}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {dateStr} {session.generated_by_name ? `• Fechado por ${session.generated_by_name}` : ""}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        className="tag"
                        style={{
                          background: "rgba(52,211,153,0.12)",
                          color: "var(--priority-low)",
                          border: "1px solid rgba(52,211,153,0.3)",
                        }}
                      >
                        {session.total_served || session.totalServed || 0} atendidos
                      </span>
                      <span
                        className="tag"
                        style={{
                          background: "rgba(248,113,113,0.12)",
                          color: "var(--priority-high)",
                          border: "1px solid rgba(248,113,113,0.3)",
                        }}
                      >
                        {session.total_abandoned || session.totalAbandoned || 0} desistências
                      </span>
                      <span
                        className="tag"
                        style={{
                          background: "var(--accent-muted)",
                          color: "var(--accent)",
                          border: "1px solid var(--accent-border)",
                        }}
                      >
                        ~{session.avg_wait_minutes || session.avgWaitMinutes || 0} min
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        onClick={() => handleOpenDetails(session)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "12px", gap: "4px" }}
                        title="Ver lista de tickets da sessão"
                      >
                        <Eye size={13} /> Detalhes
                      </button>
                      <button
                        onClick={() => handleExportCSV(session)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "12px", gap: "4px" }}
                        title="Baixar planilha CSV"
                      >
                        <FileSpreadsheet size={13} /> CSV
                      </button>
                      <button
                        onClick={() => handleExportJSON(session)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "12px", gap: "4px" }}
                        title="Baixar arquivo JSON"
                      >
                        <FileCode size={13} /> JSON
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Detalhes da Sessão */}
        {selectedSession && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <div
              className="card animate-fade"
              style={{
                width: "100%",
                maxWidth: "720px",
                maxHeight: "85vh",
                overflowY: "auto",
                padding: "24px",
                background: "var(--surface)",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>
                      {selectedSession.room_name || selectedSession.roomName}
                    </h2>
                    <span className="mono tag" style={{ fontWeight: 700 }}>
                      #{selectedSession.room_code || selectedSession.roomCode}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
                    Relatório consolidado de atendimento da sessão
                  </p>
                </div>

                <button
                  onClick={() => setSelectedSession(null)}
                  className="btn btn-secondary"
                  style={{ padding: "6px", minWidth: "auto" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Métricas do Modal */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                  marginBottom: "24px",
                }}
              >
                <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Atendidos</div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: "var(--priority-low)" }}>
                    {selectedSession.total_served || selectedSession.totalServed || 0}
                  </div>
                </div>
                <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Desistências</div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: "var(--priority-high)" }}>
                    {selectedSession.total_abandoned || selectedSession.totalAbandoned || 0}
                  </div>
                </div>
                <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Espera Média</div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: "var(--accent)" }}>
                    ~{selectedSession.avg_wait_minutes || selectedSession.avgWaitMinutes || 0} min
                  </div>
                </div>
              </div>

              {/* Lista de Tickets da Sessão */}
              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                Tickets Registrados ({selectedSession.tickets?.length || 0})
              </h3>

              {loadingSession ? (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
                  <RotateCw size={18} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  Carregando tickets...
                </div>
              ) : selectedSession.tickets && selectedSession.tickets.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto", marginBottom: "20px" }}>
                  {selectedSession.tickets.map((t, idx) => {
                    const waitMin = t.called_at && t.joined_at
                      ? ((new Date(t.called_at) - new Date(t.joined_at)) / 60000).toFixed(1)
                      : "-";
                    return (
                      <div
                        key={t.id || idx}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "13px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span className="mono" style={{ fontWeight: 700, color: "var(--primary)" }}>
                            #{t.token?.split("-").slice(-1)[0]?.toUpperCase() || t.token}
                          </span>
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                          <span className="tag" style={{ fontSize: "10px", padding: "1px 6px" }}>{t.category}</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                            Espera: {waitMin} min
                          </span>
                          <span
                            className="tag"
                            style={{
                              fontSize: "10px",
                              background: t.status === "served" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                              color: t.status === "served" ? "var(--priority-low)" : "var(--priority-high)",
                            }}
                          >
                            {t.status === "served" ? "Atendido" : "Desistiu"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--text-dim)", fontStyle: "italic", marginBottom: "20px" }}>
                  Lista detalhada de tickets individuais arquivada nesta sessão.
                </p>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => handleExportCSV(selectedSession)}
                  className="btn btn-secondary"
                  style={{ gap: "6px", fontSize: "13px" }}
                >
                  <FileSpreadsheet size={15} /> Exportar CSV
                </button>
                <button
                  onClick={() => handleExportJSON(selectedSession)}
                  className="btn btn-secondary"
                  style={{ gap: "6px", fontSize: "13px" }}
                >
                  <FileCode size={15} /> Exportar JSON
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="btn btn-primary"
                  style={{ fontSize: "13px" }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HostDashboardScreen;
