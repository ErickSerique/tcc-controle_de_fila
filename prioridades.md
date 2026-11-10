# Lista de Prioridades — Kiwii (Status de Implementação e Mesclagem)

## **Prioridades Altas**

- [x] **1. Regra de organização de fila intercalada:**
  - *Descrição:* A cada X pessoas atendidas de prioridade mais alta, chamar 1 de prioridade média/normal na hora de criar a sala para prioridades mais baixas serem atendidas (quantidade customizável pelo dono da organização via `priorityBatchSize`).
  - *Implementação:* Definido no frontend em `HostSetupScreen.jsx` (`priorityBatchSize` customizável). Processado no backend em `server/services/roomService.js` na função `recalcPositions(queue, priorityRule)` que particiona as filas em blocos e intercala o fluxo. Testado em `server/__tests__/queueService.test.js`.

- [x] **2. Confirmação antes de finalizar o dia e validação de fila vazia:**
  - *Descrição:* Botão de confirmação antes de finalizar o dia para evitar miss-click, impedindo o encerramento do dia até que a fila esteja completamente vazia (clientes atendidos ou dispensados/removidos).
  - *Implementação:* Implementado no backend em `server/services/roomService.js` (`closeDay` lança erro caso haja senhas aguardando ou em atendimento). No frontend em `QueueManagementScreen.jsx`, o modal `confirmCloseModalOpen` bloqueia o encerramento com alertas explicativos enquanto houver pessoas na fila ou chamadas, exigindo confirmação explícita quando a fila estiver limpa. Ao encerrar, gera e exibe relatório da sessão com botões para exportação em CSV e JSON.

- [x] **3. Convites por link direto e fallback de envio de e-mails:**
  - *Descrição:* Correção do envio de convites para membros da organização e solução para falha de SMTP.
  - *Implementação:* Em `server/services/orgService.js`, se o serviço de SMTP falhar ou não estiver configurado, o convite ainda é persistido com sucesso na tabela `invites` e a API retorna o link direto (`/invite/:token`). Adicionada a rota `GET /api/orgs/invites/:token`, `POST /api/auth/accept-invite`, e a tela `client/src/screens/InviteScreen.jsx`. Em `MembersScreen.jsx`, um botão de cópia rápida do link é exibido instantaneamente para envio manual.

- [x] **4. Níveis de acesso (RBAC - Dono, Administrador, Operador):**
  - *Descrição:* Implementar cargos com suas devidas permissões por instituição, exibindo o cargo daquela instituição ao selecionar no menu Home.
  - *Implementação:* Criado `server/utils/roleLevel.js` com `ROLE_LEVEL` e `hasRole`. Middleware `server/middleware/requireStaffRole.js` valida o papel do membro na instituição (`getMemberRole`). Na interface, `LandingScreen.jsx` exibe o badge do cargo atual ("Dono", "Administrador", "Operador") e restringe a visibilidade de ações administrativas (gerenciar membros, criar salas, ver logs). `MembersScreen.jsx` respeita a hierarquia (Dono edita todos, Admin só edita Operador).

- [x] **5. Multi-Guichê por sessão:**
  - *Descrição:* Permitir que funcionários adicionados à instituição operem simultaneamente na mesma sala em guichês diferentes (ex: Guichê 1, Guichê 2), visualizando a fila em tempo real.
  - *Implementação:* Configuração de múltiplos guichês em `HostSetupScreen.jsx`. Reivindicação e liberação de guichês via Socket.IO (`host:claim_counter`, `counters_update`, `counter_claimed`, e desconexão) em `roomService.js` e `handlers.js`. Na tela `QueueManagementScreen.jsx`, cada operador seleciona seu guichê individual e as chamadas registram o guichê específico. As telas `LiveTicketScreen.jsx` e `MonitorScreen.jsx` informam ao cliente exatamente a qual guichê ele deve se dirigir.

- [x] **6. Remoção de Magic Link:**
  - *Descrição:* Retirar a função de login sem senha por e-mail (magic link).
  - *Implementação:* Removido de `AuthScreen.jsx` e `useAuth.jsx`. A autenticação é realizada exclusivamente por credenciais (e-mail, senha criptografada via bcrypt e JWT).

- [x] **7. Onboarding de contas novas (0 organizações) e alternância de instituições:**
  - *Descrição:* Se a conta for nova (sem organizações), perguntar no menu principal se deseja criar ou participar de uma instituição via convite. Caso já possua organizações, permitir alternar facilmente entre elas.
  - *Implementação:* Em `LandingScreen.jsx`, quando o usuário possui 0 instituições, o sistema apresenta um painel de boas-vindas com opções para "Criar Instituição" ou "Entrar via Convite", e consulta convites pendentes por e-mail automaticamente (`/api/auth/my-invites`). Se o usuário possui instituições, exibe o seletor com troca rápida de organização ativa. `OrgSetupScreen.jsx` disponibiliza abas para criação e entrada por código/link.

- [x] **8. Funcionalidade de Trancar Fila:**
  - *Descrição:* Permitir ao atendente "trancar" a fila, impedindo que novos clientes entrem via app ou QR Code, facilitando o encerramento do expediente sem entradas infinitas.
  - *Implementação:* Backend implementado com propriedade `room.locked` em `roomService.js` e bloqueio em `queueService.js` (`joinQueue`). Socket.IO sincroniza o estado via evento `host:toggle_lock` e `room_status`. Na interface, `QueueManagementScreen.jsx` disponibiliza o botão "Trancar / Destrancar Fila" com banner visual, e `ClientCheckinScreen.jsx` exibe aviso de fila trancada desabilitando a emissão de novas senhas pelo cliente (entradas manuais pelo balcão continuam disponíveis).

---

## **Prioridades Médias**

- [x] **1. Alerta na tela do usuário ao ser chamado de volta (Recall):**
  - *Descrição:* A tela do cliente deve sinalizar de forma clara e imediata caso sua senha seja chamada de volta ao atendimento.
  - *Implementação:* Em `LiveTicketScreen.jsx`, escuta o evento de socket `ticket_recalled`, exibindo o banner "Chamado de Volta!", disparando vibração e toque sonoro (Web Audio API), e indicando o guichê para retorno.

- [x] **2. Persistência de modelo/template de categorias da fila no banco:**
  - *Descrição:* Manter as configurações de categorias e TMA salvas no banco por instituição, evitando ter que recriar ou reconfigurar todas as opções toda vez que abrir uma sala.
  - *Implementação:* Tabela `org_queue_templates` criada na migration `003_queue_templates.sql`. Endpoints `GET /api/orgs/:orgId/queue-template` e `PUT /api/orgs/:orgId/queue-template` em `orgService.js` e `routes/orgs.js`. Em `HostSetupScreen.jsx`, o template padrão é carregado automaticamente e o operador pode salvá-lo a qualquer momento com o botão "Salvar como Padrão".

- [x] **3. Atualização automática de status sem F5:**
  - *Descrição:* Atualizar automaticamente o status do cliente sem necessidade de recarregar a página (F5) quando for chamado, rechamado ou atendido.
  - *Implementação:* Handlers reativos de WebSocket (Socket.IO) integrados em `LiveTicketScreen.jsx`, `QueueManagementScreen.jsx` e `LandingScreen.jsx`, reagindo aos eventos `ticket_called`, `ticket_recalled`, `ticket_status`, `ticket_served` e `ticket_removed`.

- [x] **4. Histórico de dias passados e reexportação de relatórios:**
  - *Descrição:* Função de histórico para visualizar dias anteriores, total de atendimentos e reexportar relatórios (CSV/JSON).
  - *Implementação:* Endpoints `/api/rooms/meta/history` e `/api/rooms/:orgId/history/:sessionId`. Integrado no modal `HistoryModal.jsx` e na tela `HostDashboardScreen.jsx`, permitindo filtrar sessões passadas e baixar os arquivos CSV ou JSON a qualquer momento.

- [x] **5. Auto designar prioridade com base em campos personalizados:**
  - *Descrição:* Atribuição automática de prioridade alta/média conforme preenchimento de campos de triagem (ex: idade >= 60 anos -> Prioridade Alta), configurável pelo Dono/Admin.
  - *Implementação:* Implementado em `server/services/queueService.js` na função `evaluateAutoPriority(customFields, customData, categoryPriority)`, avaliando regras sobre campos customizados (como idade, urgência, etc.) no momento do check-in.

- [x] **6. Dashboard do Host para últimos dias e sessões:**
  - *Descrição:* Criar um dashboard com métricas consolidadas e visão dos últimos dias operados.
  - *Implementação:* `HostDashboardScreen.jsx` exibe cards de resumo (total de atendidos, dias operados, tempo médio de espera) e tabela com histórico completo das sessões finalizadas da instituição.

- [x] **7. Multi-guichês simultâneos para membros da mesma organização:**
  - *Descrição:* Membros da organização todos dentro da mesma fila com guichês diferentes (ex: Atendente A no Guichê 1, Atendente B no Guichê 2).
  - *Implementação:* Integrado no fluxo com `counters_update`, `claimCounter`, e seletor na entrada da sala em `LandingScreen.jsx` e `QueueManagementScreen.jsx`.

- [x] **8. Notificação de rechamada no menu principal do cliente:**
  - *Descrição:* Chamar a pessoa de volta deve alertá-la mesmo se ela estiver no menu principal (Home), sem exigir que ela reentre na fila manualmente para ver a alteração.
  - *Implementação:* Em `LandingScreen.jsx`, um listener do Socket.IO monitora o ticket ativo armazenado localmente (`kiwii_active_ticket`). Caso ocorra um `ticket_called` ou `ticket_recalled`, um banner flutuante em destaque surge no topo da tela com alarme visual/sonoro e botão direto para "Abrir Minha Senha".

- [x] **9. Associação automática da conta e cargo sem escolha manual:**
  - *Descrição:* Guardar a conta que está acessando a instituição e seu cargo para que o funcionário não precise selecionar seu cargo manualmente ao entrar ou abrir a sala.
  - *Implementação:* O cargo é recuperado exclusivamente do banco de dados (`organization_members.role`) e embutido no token de autenticação JWT. O sistema exibe o nome e cargo do operador automaticamente sem permitir adulteração manual.
