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
  // Campos personalizados são consistentes dentro da mesma sala/sessão —
  // usamos o primeiro ticket com customDataEntries como referência de colunas.
  const referenceTicket = report.tickets.find((t) => t.customDataEntries?.length > 0);
  const customLabels = referenceTicket?.customDataEntries?.map((e) => e.label) || [];

  const headers = [
    "Token", "Nome", "Categoria", "Prioridade", "TMA (min)",
    "Status", "Guichê", "Entrou", "Chamado", "Espera Real (min)",
    ...customLabels,
  ];

  const rows = report.tickets.map((t) => {
    const waitReal =
      t.calledAt && t.joinedAt ? ((t.calledAt - t.joinedAt) / 60_000).toFixed(1) : "-";

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
      new Date(t.joinedAt).toLocaleTimeString("pt-BR"),
      t.calledAt ? new Date(t.calledAt).toLocaleTimeString("pt-BR") : "-",
      waitReal,
      ...customValues,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  // BOM (\uFEFF) garante que o Excel reconheça UTF-8 automaticamente
  triggerDownload(
    new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }),
    `relatorio_${report.roomCode}_${formatFileDatetime()}.csv`
  );
};

// ── JSON ──────────────────────────────────────────────────────

/**
 * Exporta o relatório de sessão como arquivo .json formatado.
 */
export const exportToJSON = (report) => {
  triggerDownload(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    `relatorio_${report.roomCode}_${formatFileDatetime()}.json`
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
