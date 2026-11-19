# Lista de Prioridades — Projeto Kiwii

> Status atualizado em 2026-11-18

---

## Prioridades Altas (Críticas)

- [x] **Login e criar conta não funcionam sem internet** (mesmo sistema de sync quando a internet voltar?) [testar]
  - *Implementado:* Sistema de JWT local com sessão offline. `api.js` tem `saveLocalSession`/`getLocalSession`/`clearLocalSession` para manter token no `localStorage`. Socket reconecta automaticamente. ✅

- [x] **Adicionar tipo de dado "data" como campo personalizado**, caso o estabelecimento precise da data de nascimento do usuário
  - *Implementado:* `CustomFieldInput.jsx` suporta `type: "date"` com `<input type="date">`. `HostSetupScreen.jsx` lista "Data" nos tipos de campo disponíveis. ✅

- [x] **Como integrar o programa em dispositivos diferentes (interface mobile)**
  - *Implementado:* PWA com `vite-plugin-pwa`, `manifest.webmanifest`, service worker. Layout responsivo via CSS. ✅

- [x] **Ter uma mensagem de aviso caso o usuário tente sair da fila após ser chamado novamente**
  - *Implementado:* `LiveTicketScreen.jsx` exibe `ConfirmModal` com alerta quando o usuário tenta sair da fila após ser chamado. Mensagem de cancelamento de atendimento exibida. ✅

- [x] **Ao chamar a pessoa de volta para a fila, poder alterar a categoria para outra ou colocar automaticamente uma (por exemplo, "Retorno")**
  - *Implementado:* `RecallModal.jsx` permite selecionar categoria (botões rápidos + dropdown). `queueService.recallTicket` aceita `category` e aplica ao ticket com `isRecall = true`. Socket handler `host:recall` emite com categoria. ✅

---

## Prioridades Médias (Melhorias Importantes)

- [x] **Histórico do dia se mantém permanentemente no banco de dados**
  - *Implementado:* `roomService.closeDay` persiste sessão completa na tabela `room_sessions` do PostgreSQL com fire-and-forget. `getHistory`/`getHistorySession` consultam PostgreSQL com fallback para memória. Migração SQL `004_sessions_and_roles.sql` cria as tabelas. ✅

- [x] **Separar as salas como "dias" (Salas Salvas / Presets)**
  - *Implementado:* Salas permanentes salvas via `orgService` (`saved_rooms` no banco). `HostSetupScreen.jsx` tem opção "Salvar Modelo Permanente". `LandingScreen.jsx` lista salas cadastradas com botão "Iniciar Dia" que chama `openDayRoom`. Endpoints REST completos em `routes/orgs.js`. ✅

- [x] **Notificação de recall no celular** (Pedi para entrar na fila novamente e nada apareceu no celular)
  - *Implementado:* `LiveTicketScreen.jsx` limpa `terminalStatus` ao receber `ticket_called`/`ticket_recalled`, recuperando da tela de "atendido". Socket handler `client:join` corrigido. `localStorage` lê ambas as chaves `kiwii_active_ticket` e `fila_io_active_ticket`. ✅

- [x] **Intercalação de prioridade em cascata** (Alta → Média → Baixa com `highBatchSize` e `medBatchSize`)
  - *Implementado:* `roomService.recalcPositions` usa cascata: puxa bloco de altas (`highBatchSize`), intercala com médias, e a cada `medBatchSize` médias atendidas intercala uma baixa. `HostSetupScreen.jsx` tem campos separados para configurar ambos os batch sizes. ✅

- [x] **Melhorar o dashboard** (filtros, exportação, auditoria)
  - *Implementado:* `HostDashboardScreen.jsx` reescrito com: filtro por data (Hoje/7d/30d/custom/todos), filtro por operador, filtro de volume mínimo, busca. Gráfico de barras interativo para volume diário. Tabela de auditoria na modal de detalhes com colunas Entrada/Chamada/Conclusão/Espera Real. Exportação CSV, Excel (via `exportToExcel`), PDF (via `exportToPDF`) e JSON. ✅

- [x] **Incluir log** (ações dos funcionários: "abriu", "trancou", "fechou o dia", com horário)
  - *Implementado:* `logService.js` registra ações com timestamp. `LogsModal.jsx` exibe trilha de auditoria. Logs gravados na sessão e persistidos no PostgreSQL junto com `closeDay`. ✅

- [x] **Gráficos no dashboard**
  - *Implementado:* Gráfico de barras interativo em `HostDashboardScreen.jsx` mostrando volume diário de atendimentos. ✅

- [x] **Link temporário de convite** (tirar email, só botão de link temporário, fila de aprovação)
  - *Implementado:* `MembersScreen.jsx` removeu formulário de email. Botão "Gerar Link de Convite Temporário (30 min)" com copy-to-clipboard. Seção "Fila de Entrada — Solicitações Pendentes" com botões Aprovar/Recusar. `InviteScreen.jsx` suporta links temporários com tela de "Solicitar Entrada na Equipe". Backend completo com `orgService` + `routes/orgs.js`. ✅

- [x] **Bug do botão "Monitor"** (apertar o botão de "monitor" e voltar pro guia anterior causa erro)
  - *Implementado:* `socket.js` agora rastreia `currentAuthToken` e pula reconnect se já conectado com mesmo token, evitando que `onAuthStateChange` cross-tab quebre a conexão. `socket/handlers.js` tem `ensureStaffActor` para prevenir erros de actor undefined. ✅

- [x] **Verificar permissões e autorização** (operador convidado podia modificar configurações da sala)
  - *Implementado:* `requireStaffRole.js` no middleware filtra por role. `HostSetupScreen.jsx` verifica `isAdmin` antes de exibir configurações. Checks `["admin", "owner"].includes(role)` em todas as telas sensíveis. ✅

- [x] **Remover o cargo de "Dono"** (só Admin e Operador)
  - *Implementado:* `roleLevel.js` mapeia `owner → admin`. Todos os `ROLE_LABELS` em todas as telas exibem "Administrador" para `owner`. Selects de role não oferecem "Dono" como opção. Backend `orgService.js` converte `owner → admin` ao retornar membros. ✅

---

## Verificações Técnicas Complementares

- [x] **Testes unitários** — 25/25 testes passando (auth: 8/8, queueService: 17/17) ✅
- [x] **Build de produção** — `vite build` compila sem erros (1618 módulos, ~960 KB) ✅
- [x] **Rotas API alinhadas** — Frontend `api.js` paths corrigidos para bater com `routes/orgs.js` do servidor ✅
- [x] **Fragmentos JSX removidos** — `MembersScreen.jsx` e `InviteScreen.jsx` limpos de código duplicado ✅
