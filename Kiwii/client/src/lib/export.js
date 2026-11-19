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

// ── Excel (.xls) ───────────────────────────────────────────────

/**
 * Exporta como arquivo compatível com Excel (.xls) usando tabela HTML formatada.
 */
export const exportToExcel = (report) => {
  if (!report || !report.tickets) return;

  const referenceTicket = report.tickets.find((t) => t.customDataEntries?.length > 0);
  const customLabels = referenceTicket?.customDataEntries?.map((e) => e.label) || [];

  const headers = [
    "Token", "Nome", "Categoria", "Prioridade", "TMA (min)",
    "Status", "Guichê", "Entrada", "Chamado", "Concluído", "Espera Real (min)",
    ...customLabels,
  ];

  const rows = report.tickets.map((t) => {
    const calledTime = t.calledAt || (t.called_at ? new Date(t.called_at).getTime() : null);
    const joinedTime = t.joinedAt || (t.joined_at ? new Date(t.joined_at).getTime() : null);
    const servedTime = t.servedAt || (t.served_at ? new Date(t.served_at).getTime() : null);

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
      servedTime ? new Date(servedTime).toLocaleTimeString("pt-BR") : "-",
      waitReal,
      ...customValues,
    ];
  });

  const tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Relatório</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        th { background-color: #059669; color: #ffffff; font-weight: bold; border: 1px solid #d1d5db; padding: 6px; }
        td { border: 1px solid #e5e7eb; padding: 6px; }
      </style>
    </head>
    <body>
      <h2>Relatório de Atendimentos — Sala ${report.roomCode || report.room_code || ""}</h2>
      <p>Data: ${new Date().toLocaleDateString("pt-BR")} | Total Atendidos: ${report.total_served ?? report.stats?.served ?? report.tickets.filter(t => t.status === "served").length}</p>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const roomCode = report.roomCode || report.room_code || "sessao";
  triggerDownload(
    new Blob(["\uFEFF" + tableHtml], { type: "application/vnd.ms-excel;charset=utf-8;" }),
    `relatorio_${roomCode}_${formatFileDatetime()}.xls`
  );
};

// ── PDF (Impressão Direta) ────────────────────────────────────

/**
 * Abre janela de impressão formatada em PDF para o relatório da sessão.
 */
export const exportToPDF = (report) => {
  if (!report || !report.tickets) return;

  const roomCode = report.roomCode || report.room_code || "sessao";
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalServed =
    report.total_served ?? report.stats?.served ?? report.tickets.filter((t) => t.status === "served").length;
  const tmaAvg = report.tma_avg ?? report.stats?.avgWaitMin ?? "-";

  const rowsHtml = report.tickets
    .map((t) => {
      const calledTime = t.calledAt || (t.called_at ? new Date(t.called_at).getTime() : null);
      const joinedTime = t.joinedAt || (t.joined_at ? new Date(t.joined_at).getTime() : null);
      const servedTime = t.servedAt || (t.served_at ? new Date(t.served_at).getTime() : null);
      const waitReal =
        calledTime && joinedTime ? ((calledTime - joinedTime) / 60_000).toFixed(1) + " min" : "-";
      const priorityLabel = t.priority === 3 ? "Alta" : t.priority === 2 ? "Média" : "Baixa";
      const statusLabel = STATUS_LABELS[t.status] || t.status;

      return `
      <tr>
        <td><strong>${t.token}</strong></td>
        <td>${t.name}</td>
        <td>${t.category}</td>
        <td>${priorityLabel}</td>
        <td>${t.counter || "-"}</td>
        <td>${statusLabel}</td>
        <td>${joinedTime ? new Date(joinedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
        <td>${calledTime ? new Date(calledTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
        <td>${servedTime ? new Date(servedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
        <td>${waitReal}</td>
      </tr>
    `;
    })
    .join("");

  const logsHtml = (report.logs || report.logs_data || [])
    .map(
      (log) => `
    <div style="font-size: 11px; padding: 4px 0; border-bottom: 1px solid #f3f4f6; color: #4b5563;">
      <span style="color: #9ca3af; font-family: monospace;">[${new Date(log.timestamp).toLocaleTimeString("pt-BR")}]</span>
      <strong>${log.actorName || log.actor || "Sistema"}:</strong> ${log.description || log.action}
    </div>
  `
    )
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Permita pop-ups para imprimir o relatório em PDF.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Relatório de Atendimento - ${roomCode}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 24px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { margin: 0; font-size: 20px; color: #065f46; }
        .header p { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; }
        .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
        .stat-value { font-size: 18px; font-weight: bold; color: #111827; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
        th { background: #f3f4f6; color: #374151; font-weight: 600; text-align: left; padding: 8px 6px; border-bottom: 1px solid #d1d5db; }
        td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #fafafa; }
        .logs-section { margin-top: 24px; page-break-inside: avoid; }
        .logs-title { font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #374151; }
        @media print {
          body { margin: 0; }
          button { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div style="margin-bottom: 12px;">
        <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Imprimir / Salvar PDF</button>
      </div>
      <div class="header">
        <div>
          <h1>Relatório de Sessão — Sala ${roomCode}</h1>
          <p>Emitido em ${dateStr}</p>
        </div>
        <div style="text-align: right;">
          <strong style="color: #059669; font-size: 14px;">Kiwii Fila Inteligente</strong>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Atendidos</div>
          <div class="stat-value">${totalServed}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Cadastrados</div>
          <div class="stat-value">${report.tickets.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tempo Médio Estimado</div>
          <div class="stat-value">${tmaAvg} min</div>
        </div>
      </div>

      <h3 style="font-size: 14px; margin-bottom: 8px;">Auditoria de Atendimentos</h3>
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Prioridade</th>
            <th>Guichê</th>
            <th>Status</th>
            <th>Entrada</th>
            <th>Chamada</th>
            <th>Conclusão</th>
            <th>Espera Real</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      ${
        logsHtml
          ? `
        <div class="logs-section">
          <div class="logs-title">Registro de Ações da Sessão (Logs)</div>
          ${logsHtml}
        </div>
      `
          : ""
      }
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
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
