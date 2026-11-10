/**
 * export.js — utilitários de exportação de relatórios de sessão.
 *
 * Formatos suportados: CSV (compatível com Excel pt-BR) e JSON.
 * Inclui automaticamente colunas para status detalhado (atendido /
 * removido / saiu voluntariamente) e para campos personalizados
 * configurados pelo host, se houver.
 */

const STATUS_LABELS = {
  served: "Atendido",
  removed_by_host: "Removido pelo Host",
  left_voluntarily: "Saiu Voluntariamente",
  abandoned: "Abandonado",
  abandoned_queue_closed: "Fila Encerrada (aguardando)",
  called: "Chamando",
  waiting: "Aguardando",
};

// ── CSV ───────────────────────────────────────────────────────

/**
 * Exporta o relatório de sessão como arquivo .csv.
 * Usa ponto-e-vírgula como separador e BOM UTF-8 para compatibilidade com Excel.
 */
export const exportToCSV = (report) => {
  if (!report || !report.tickets) return;

  const referenceTicket = report.tickets.find((t) => t.customDataEntries?.length > 0);
  const customLabels = referenceTicket?.customDataEntries?.map((e) => e.label) || [];

  const headers = [
    "Token", "Nome", "Categoria", "Prioridade", "TMA (min)",
    "Status", "Guichê", "Entrou", "Chamado", "Espera Real (min)",
    ...customLabels,
  ];

  const rows = report.tickets.map((t) => {
    const calledTime = t.calledAt || (t.called_at ? new Date(t.called_at).getTime() : null);
    const joinedTime = t.joinedAt || (t.joined_at ? new Date(t.joined_at).getTime() : null);

    const waitReal =
      calledTime && joinedTime ? ((calledTime - joinedTime) / 60_000).toFixed(1) : "-";

    const priorityLabel = t.priority === 3 ? "Alta" : t.priority === 2 ? "Média" : "Baixa";
    const statusLabel = STATUS_LABELS[t.status] || t.status;
    const customValues = (t.customDataEntries || []).map((e) =>
      typeof e.value === "boolean" ? (e.value ? "Sim" : "Não") : (e.value ?? "-")
    );

    return [
      t.token,
      t.name,
      t.category,
      priorityLabel,
      t.tma,
      statusLabel,
      t.counter || "-",
      joinedTime ? new Date(joinedTime).toLocaleTimeString("pt-BR") : "-",
      calledTime ? new Date(calledTime).toLocaleTimeString("pt-BR") : "-",
      waitReal,
      ...customValues,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const roomCode = report.roomCode || report.room_code || "sessao";
  triggerDownload(
    new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }),
    `relatorio_${roomCode}_${formatFileDatetime()}.csv`
  );
};

// ── JSON ──────────────────────────────────────────────────────

export const exportToJSON = (report) => {
  const roomCode = report.roomCode || report.room_code || "sessao";
  triggerDownload(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    `relatorio_${roomCode}_${formatFileDatetime()}.json`
  );
};

// ── Helpers ───────────────────────────────────────────────────

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const formatFileDatetime = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}`
  );
};
