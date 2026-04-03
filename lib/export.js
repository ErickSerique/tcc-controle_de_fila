/**
 * Export utilities for session reports.
 * In production you can swap the CSV logic for the json2csv library.
 */

/**
 * Downloads the session report as a UTF-8 CSV file.
 * Uses semicolon separator for better Excel (pt-BR) compatibility.
 */
export const exportToCSV = (report) => {
  const headers = [
    "Token",
    "Nome",
    "Categoria",
    "Prioridade",
    "TMA (min)",
    "Status",
    "Entrou",
    "Chamado",
    "Espera Real (min)",
  ];

  const rows = report.tickets.map((t) => {
    const waitReal =
      t.calledAt && t.joinedAt
        ? ((t.calledAt - t.joinedAt) / 60000).toFixed(1)
        : "-";
    return [
      t.token,
      t.name,
      t.category,
      t.priority === 3 ? "Alta" : t.priority === 2 ? "Média" : "Baixa",
      t.tma,
      t.status === "served" ? "Atendido" : "Abandonou",
      new Date(t.joinedAt).toLocaleTimeString("pt-BR"),
      t.calledAt ? new Date(t.calledAt).toLocaleTimeString("pt-BR") : "-",
      waitReal,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(";"))
    .join("\n");

  // BOM for Excel pt-BR UTF-8 recognition
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  triggerDownload(blob, `relatorio_${report.roomCode}_${formatDateFilename()}.csv`);
};

/**
 * Downloads the session report as a formatted JSON file.
 */
export const exportToJSON = (report) => {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `relatorio_${report.roomCode}_${formatDateFilename()}.json`);
};

// ─── Helpers ──────────────────────────────────────────────────

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const formatDateFilename = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
};
