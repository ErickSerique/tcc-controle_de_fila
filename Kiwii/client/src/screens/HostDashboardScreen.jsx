/**
 * screens/HostDashboardScreen.jsx
 *
 * Design System v3.0 — Dashboard do Host & Histórico de Dias Passados (M4/M6 & Prioridades 9/10/11)
 * Exibe métricas consolidadas, gráficos de volume diário, filtros por data e atendente,
 * auditoria detalhada de horários e logs, e exportação para CSV, Excel e PDF.
 */
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchHistory, fetchSessionReport } from "../lib/api";
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "../lib/export";
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
  Printer,
  Filter,
  User,
  ScrollText,
} from "lucide-react";

const HostDashboardScreen = ({ onBack }) => {
  const { activeOrg } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // Filtros avançados (Prioridade 9)
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterPreset, setDateFilterPreset] = useState("all"); // 'all' | 'today' | '7d' | '30d' | 'custom'
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("all");
  const [minVolume, setMinVolume] = useState("");

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

  const handleExportExcel = async (sessionSummary) => {
    try {
      let reportData = sessionSummary;
      if (!sessionSummary.tickets) {
        const data = await fetchSessionReport(activeOrg.id, sessionSummary.id);
        reportData = data.report || sessionSummary;
      }
      exportToExcel(reportData);
    } catch (err) {
      alert("Erro ao exportar Excel: " + err.message);
    }
  };

  const handleExportPDF = async (sessionSummary) => {
    try {
      let reportData = sessionSummary;
      if (!sessionSummary.tickets) {
        const data = await fetchSessionReport(activeOrg.id, sessionSummary.id);
        reportData = data.report || sessionSummary;
      }
      exportToPDF(reportData);
    } catch (err) {
      alert("Erro ao gerar PDF: " + err.message);
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

  // Lista de operadores disponíveis no histórico para o filtro
  const availableOperators = useMemo(() => {
    const ops = new Set();
    history.forEach((h) => {
      const name = h.generated_by_name || h.operator || h.closed_by_name;
      if (name) ops.add(name);
    });
    return Array.from(ops);
  }, [history]);

  // Filtro consolidado de sessões
  const filteredHistory = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return history.filter((h) => {
      const term = searchTerm.toLowerCase();
      const name = (h.room_name || h.roomName || "").toLowerCase();
      const code = (h.room_code || h.roomCode || "").toLowerCase();
      if (term && !name.includes(term) && !code.includes(term)) return false;

      // Filtro de Atendente
      if (selectedOperator !== "all") {
        const opName = h.generated_by_name || h.operator || h.closed_by_name || "";
        if (opName !== selectedOperator) return false;
      }

      // Filtro de Volume Mínimo
      const servedCount = parseInt(h.total_served || h.totalServed || 0, 10);
      if (minVolume && servedCount < parseInt(minVolume, 10)) return false;

      // Filtro de Data
      const sessionDateStr = h.started_at || h.created_at || h.date || h.closed_at;
      if (!sessionDateStr) return true;
      const sessionDate = new Date(sessionDateStr);

      if (dateFilterPreset === "today") {
        return sessionDate.toISOString().slice(0, 10) === todayStr;
      }
      if (dateFilterPreset === "7d") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return sessionDate >= sevenDaysAgo;
      }
      if (dateFilterPreset === "30d") {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return sessionDate >= thirtyDaysAgo;
      }
      if (dateFilterPreset === "custom") {
        if (startDate && sessionDate < new Date(startDate + "T00:00:00")) return false;
        if (endDate && sessionDate > new Date(endDate + "T23:59:59")) return false;
      }

      return true;
    });
  }, [history, searchTerm, selectedOperator, minVolume, dateFilterPreset, startDate, endDate]);

  // KPIs consolidados sobre o histórico filtrado
  const totalServed = filteredHistory.reduce(
    (acc, h) => acc + parseInt(h.total_served || h.totalServed || 0, 10),
    0
  );
  const totalAbandoned = filteredHistory.reduce(
    (acc, h) => acc + parseInt(h.total_abandoned || h.totalAbandoned || 0, 10),
    0
  );
  const avgWait =
    filteredHistory.length > 0
      ? (
          filteredHistory.reduce(
            (acc, h) => acc + parseFloat(h.avg_wait_minutes || h.avgWaitMinutes || 0),
            0
          ) / filteredHistory.length
        ).toFixed(1)
      : "0.0";

  // Dados para o Gráfico de Demanda Diária (Prioridade 11)
  const chartData = useMemo(() => {
    const dayMap = {};
    filteredHistory.forEach((s) => {
      const d = s.started_at || s.created_at || s.date || s.closed_at;
      const key = d
        ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : "Hoje";
      dayMap[key] = (dayMap[key] || 0) + (parseInt(s.total_served || s.totalServed || 0, 10) || 0);
    });
    return Object.entries(dayMap).map(([day, count]) => ({ day, count }));
  }, [filteredHistory]);

  const maxChartCount = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.count), 5);
    return max;
  }, [chartData]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "32px 24px",
        maxWidth: "1020px",
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
                <h1 style={{ fontSize: "24px", fontWeight: 800, margin: 0 }}>
                  Dashboard & Histórico de Atendimentos
                </h1>
                <span className="tag" style={{ textTransform: "uppercase" }}>
                  {activeOrg?.name}
                </span>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "4px 0 0" }}>
                Métricas em tempo real, auditoria completa, relatórios exportáveis e análise de demanda.
              </p>
            </div>
          </div>

          <button
            onClick={loadHistory}
            className="btn btn-secondary"
            style={{ padding: "8px 14px", gap: "6px", fontSize: "13px" }}
            disabled={loading}
          >
            <RotateCw size={14} className={loading ? "spin" : ""} />
            Atualizar
          </button>
        </div>

        {/* KPIs Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "28px",
          }}
        >
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                Total Atendidos
              </span>
              <div style={{ color: "var(--primary)", background: "var(--primary-muted)", padding: "6px", borderRadius: "8px" }}>
                <CheckCircle size={18} />
              </div>
            </div>
            <div className="mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
              {totalServed}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Pacientes concluídos no período
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                Desistências
              </span>
              <div style={{ color: "var(--danger)", background: "var(--danger-glow)", padding: "6px", borderRadius: "8px" }}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
              {totalAbandoned}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Removidos ou saídas voluntárias
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                Tempo Médio Espera
              </span>
              <div style={{ color: "var(--warn)", background: "rgba(245, 158, 11, 0.12)", padding: "6px", borderRadius: "8px" }}>
                <Clock size={18} />
              </div>
            </div>
            <div className="mono" style={{ fontSize: "32px", fontWeight: 800, color: "var(--text)" }}>
              ~{avgWait} <span style={{ fontSize: "16px", fontWeight: 500 }}>min</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Média entre entrada e chamado
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
              {filteredHistory.length}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Sessões com dados permanentes
            </div>
          </div>
        </div>

        {/* Gráfico Visual de Demanda Diária (Prioridade 11) */}
        {chartData.length > 0 && (
          <div className="card" style={{ padding: "20px 24px", marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart3 size={18} color="var(--primary)" />
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  Demanda de Atendimentos por Dia
                </h3>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Volume de atendimentos concluídos
              </span>
            </div>

            <div style={{ height: "160px", display: "flex", alignItems: "flex-end", gap: "16px", paddingTop: "20px" }}>
              {chartData.map((d, idx) => {
                const heightPct = Math.max(8, Math.round((d.count / maxChartCount) * 100));
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      height: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    <span className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)", marginBottom: "4px" }}>
                      {d.count}
                    </span>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "42px",
                        height: `${heightPct}%`,
                        background: "var(--primary)",
                        borderRadius: "6px 6px 0 0",
                        opacity: 0.85,
                        transition: "height 0.3s ease",
                      }}
                    />
                    <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px" }}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Painel de Filtros Avançados (Prioridade 9) */}
        <div className="card" style={{ padding: "18px 20px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Filter size={16} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>Filtros de Auditoria</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            {/* Presets de Data */}
            <div>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>
                Período
              </label>
              <select
                className="input"
                value={dateFilterPreset}
                onChange={(e) => setDateFilterPreset(e.target.value)}
                style={{ fontSize: "13px" }}
              >
                <option value="all">Todo o Período</option>
                <option value="today">Hoje</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="custom">Personalizado (Início / Fim)</option>
              </select>
            </div>

            {/* Atendente Responsável */}
            <div>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>
                Atendente
              </label>
              <select
                className="input"
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                style={{ fontSize: "13px" }}
              >
                <option value="all">Todos os Atendentes</option>
                {availableOperators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume Mínimo */}
            <div>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>
                Volume Mínimo (Atendidos)
              </label>
              <input
                className="input"
                type="number"
                placeholder="Ex: 5"
                value={minVolume}
                onChange={(e) => setMinVolume(e.target.value)}
                style={{ fontSize: "13px" }}
              />
            </div>

            {/* Busca por Texto */}
            <div>
              <label className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>
                Buscar Sala
              </label>
              <input
                className="input"
                placeholder="Nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: "13px" }}
              />
            </div>
          </div>

          {/* Seleção de Datas Customizadas */}
          {dateFilterPreset === "custom" && (
            <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "160px" }}>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Data Inicial
                </label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ fontSize: "13px" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "160px" }}>
                <label className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                  Data Final
                </label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ fontSize: "13px" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Lista de Sessões Anteriores */}
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
            Sessões Registradas ({filteredHistory.length})
          </h2>
        </div>

        {loading ? (
          <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
            <RotateCw size={24} className="spin" style={{ margin: "0 auto 12px" }} />
            Carregando sessões...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
            Nenhuma sessão encontrada para os filtros selecionados.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredHistory.map((session) => {
              const rawDate = session.started_at || session.created_at || session.closed_at || session.date;
              const dateStr = rawDate
                ? new Date(rawDate).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Data não registrada";

              return (
                <div
                  key={session.id || session.room_code || session.roomCode}
                  className="card"
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "14px",
                    background: "var(--surface)",
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
                        {dateStr} {session.generated_by_name ? `• Atendente: ${session.generated_by_name}` : ""}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="tag" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>
                        {session.total_served || session.totalServed || 0} atendidos
                      </span>
                      <span className="tag" style={{ background: "var(--danger-glow)", color: "var(--danger)" }}>
                        {session.total_abandoned || session.totalAbandoned || 0} desistências
                      </span>
                      <span className="tag">
                        ~{session.avg_wait_minutes || session.avgWaitMinutes || 0} min
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        onClick={() => handleOpenDetails(session)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "12px", gap: "4px", fontWeight: 600 }}
                        title="Ver auditoria detalhada da sessão"
                      >
                        <Eye size={13} /> Auditoria
                      </button>
                      <button
                        onClick={() => handleExportCSV(session)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "12px", gap: "4px" }}
                        title="Exportar CSV"
                      >
                        <FileSpreadsheet size={13} /> CSV
                      </button>
                      <button
                        onClick={() => handleExportExcel(session)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "12px", gap: "4px" }}
                        title="Exportar Excel (.xls)"
                      >
                        <FileSpreadsheet size={13} /> Excel
                      </button>
                      <button
                        onClick={() => handleExportPDF(session)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "12px", gap: "4px" }}
                        title="Imprimir ou Salvar PDF"
                      >
                        <Printer size={13} /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Detalhes e Auditoria da Sessão (Prioridades 9 & 10) */}
        {selectedSession && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.75)",
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
                maxWidth: "840px",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: "24px",
                background: "var(--surface)",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                      {selectedSession.room_name || selectedSession.roomName}
                    </h2>
                    <span className="mono tag" style={{ fontWeight: 700 }}>
                      #{selectedSession.room_code || selectedSession.roomCode}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
                    Auditoria completa: horários de clientes, guichês e registro de ações dos atendentes
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
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: "var(--primary)" }}>
                    {selectedSession.total_served || selectedSession.totalServed || 0}
                  </div>
                </div>
                <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Desistências</div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: "var(--danger)" }}>
                    {selectedSession.total_abandoned || selectedSession.totalAbandoned || 0}
                  </div>
                </div>
                <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Espera Média</div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: 800, color: "var(--warn)" }}>
                    ~{selectedSession.avg_wait_minutes || selectedSession.avgWaitMinutes || 0} min
                  </div>
                </div>
              </div>

              {/* Tabela de Auditoria de Clientes com Horários Exatos (Prioridade 9) */}
              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", color: "var(--text)" }}>
                Auditoria de Clientes ({selectedSession.tickets?.length || 0})
              </h3>

              {loadingSession ? (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)" }}>
                  <RotateCw size={18} className="spin" style={{ margin: "0 auto 8px" }} />
                  Carregando dados da sessão...
                </div>
              ) : selectedSession.tickets && selectedSession.tickets.length > 0 ? (
                <div style={{ overflowX: "auto", marginBottom: "24px", border: "1px solid var(--border)", borderRadius: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-hover)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "8px 10px" }}>Senha</th>
                        <th style={{ padding: "8px 10px" }}>Nome</th>
                        <th style={{ padding: "8px 10px" }}>Categoria</th>
                        <th style={{ padding: "8px 10px" }}>Guichê</th>
                        <th style={{ padding: "8px 10px" }}>Entrada</th>
                        <th style={{ padding: "8px 10px" }}>Chamada</th>
                        <th style={{ padding: "8px 10px" }}>Conclusão</th>
                        <th style={{ padding: "8px 10px" }}>Espera Real</th>
                        <th style={{ padding: "8px 10px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSession.tickets.map((t, idx) => {
                        const joinedTime = t.joinedAt || (t.joined_at ? new Date(t.joined_at).getTime() : null);
                        const calledTime = t.calledAt || (t.called_at ? new Date(t.called_at).getTime() : null);
                        const servedTime = t.servedAt || (t.served_at ? new Date(t.served_at).getTime() : null);

                        const waitReal =
                          calledTime && joinedTime
                            ? ((calledTime - joinedTime) / 60000).toFixed(1) + " min"
                            : "-";

                        return (
                          <tr key={t.id || t.token || idx} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td className="mono" style={{ padding: "8px 10px", fontWeight: 700, color: "var(--primary)" }}>
                              #{t.code || t.ticketNumber || String(idx + 1).padStart(3, "0")}
                            </td>
                            <td style={{ padding: "8px 10px", fontWeight: 600 }}>{t.name}</td>
                            <td style={{ padding: "8px 10px" }}>{t.category}</td>
                            <td style={{ padding: "8px 10px" }}>{t.counter || "-"}</td>
                            <td style={{ padding: "8px 10px" }}>
                              {joinedTime ? new Date(joinedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {calledTime ? new Date(calledTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {servedTime ? new Date(servedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                            <td style={{ padding: "8px 10px" }}>{waitReal}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span
                                className="tag"
                                style={{
                                  fontSize: "10px",
                                  background: t.status === "served" ? "var(--primary-muted)" : "var(--danger-glow)",
                                  color: t.status === "served" ? "var(--primary)" : "var(--danger)",
                                }}
                              >
                                {t.status === "served" ? "Atendido" : "Desistiu"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", fontStyle: "italic", marginBottom: "20px" }}>
                  Tickets arquivados com o resumo desta sessão.
                </p>
              )}

              {/* Registro de Ações dos Atendentes / Logs (Prioridade 10) */}
              {(selectedSession.logs || selectedSession.logs_data || []).length > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <ScrollText size={16} color="var(--primary)" />
                    <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, textTransform: "uppercase", color: "var(--text)" }}>
                      Registro de Ações da Sessão (Logs)
                    </h3>
                  </div>
                  <div
                    style={{
                      maxHeight: "180px",
                      overflowY: "auto",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {(selectedSession.logs || selectedSession.logs_data).map((log, lidx) => (
                      <div key={lidx} style={{ display: "flex", gap: "8px", color: "var(--text-secondary)" }}>
                        <span className="mono" style={{ color: "var(--text-dim)" }}>
                          [{new Date(log.timestamp).toLocaleTimeString("pt-BR")}]
                        </span>
                        <strong style={{ color: "var(--text)" }}>{log.actorName || log.actor || "Sistema"}:</strong>
                        <span>{log.description || log.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de Ação e Exportação */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleExportCSV(selectedSession)}
                    className="btn btn-secondary"
                    style={{ gap: "6px", fontSize: "13px" }}
                  >
                    <FileSpreadsheet size={15} /> Baixar CSV
                  </button>
                  <button
                    onClick={() => handleExportExcel(selectedSession)}
                    className="btn btn-secondary"
                    style={{ gap: "6px", fontSize: "13px" }}
                  >
                    <FileSpreadsheet size={15} /> Baixar Excel (.xls)
                  </button>
                  <button
                    onClick={() => handleExportPDF(selectedSession)}
                    className="btn btn-secondary"
                    style={{ gap: "6px", fontSize: "13px" }}
                  >
                    <Printer size={15} /> Imprimir / PDF
                  </button>
                  <button
                    onClick={() => handleExportJSON(selectedSession)}
                    className="btn btn-secondary"
                    style={{ gap: "6px", fontSize: "13px" }}
                  >
                    <FileCode size={15} /> JSON
                  </button>
                </div>

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