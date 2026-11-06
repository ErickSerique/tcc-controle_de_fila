/**
 * client/src/lib/export.js
 * Utilitários de exportação de relatórios de sessão.
 */

export const exportToCSV = (report) => {
  const headers = ["Token","Nome","Categoria","Prioridade","TMA (min)","Status","Entrou","Chamado","Espera Real (min)"];

  const rows = report.tickets.map((t) => {
    const waitReal = t.called_at && t.joined_at
      ? ((new Date(t.called_at) - new Date(t.joined_at)) / 60000).toFixed(1)
      : "-";
    return [
      t.token, t.name, t.category,
      t.priority === 3 ? "Alta" : t.priority === 2 ? "Média" : "Baixa",
      t.tma,
      t.status === "served" ? "Atendido" : "Abandonou",
      new Date(t.joined_at).toLocaleTimeString("pt-BR"),
      t.called_at ? new Date(t.called_at).toLocaleTimeString("pt-BR") : "-",
      waitReal,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `relatorio_${report.room_code}_${formatDateFilename()}.csv`);
};

export const exportToJSON = (report) => {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  triggerDownload(blob, `relatorio_${report.room_code}_${formatDateFilename()}.json`);
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

const formatDateFilename = () => {
  const n = new Date();
  return `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}_${String(n.getHours()).padStart(2,"0")}${String(n.getMinutes()).padStart(2,"0")}`;
};
