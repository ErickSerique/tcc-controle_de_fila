# AGENTS.md — Kiwii (TCC · Controle de Fila)

Guia para agentes de IA (Claude Code, Codex, Cursor etc.) que trabalham neste repositório.
Fonte única de verdade para o contexto do projeto; o `CLAUDE.md` apenas importa este arquivo.

> Este documento foi gerado a partir da leitura do código-fonte. Onde o código e o `README.md`
> divergem, **vale o código** (o README está desatualizado — ver seção 8).

---

## 1. O que é o projeto

**Kiwii** (antes chamado "fila.io") é um SaaS de gestão de filas em tempo real, feito como TCC.
Um estabelecimento (organização) abre uma **sala** de atendimento; clientes entram na fila pelo
celular (QR Code ou código de 6 caracteres, sem conta); a equipe chama, atende e remove pessoas em
tempo real; uma TV externa (**Monitor**) mostra quem está sendo chamado.

Conceitos do domínio (usar estes termos, em português, na UI e nos comentários):

| Termo | Significado |
|---|---|
| **Organização / instituição** | Estabelecimento. Tem membros com cargo (`owner`, `admin`, `operator`). |
| **Sala** | Sessão de atendimento de um dia/turno, com código público de 6 caracteres. |
| **Categoria** | Tipo de atendimento: `{ name, priority (1–3), tma (min) }`. Prioridade **3 = Alta**, 1 = Baixa. |
| **Guichê (counter)** | Ponto de atendimento. Hoje é só um nome (string) escolhido pelo host ao chamar. |
| **Campo personalizado** | Dado extra exigido no check-in (texto, número, seleção, sim/não). |
| **Ticket** | Entrada de uma pessoa na fila. |
| **Recall (chamar de volta)** | Traz de volta um ticket já atendido/removido/que saiu. |
| **Encerrar o dia** | Fecha a sala e gera o relatório da sessão (exportável em CSV/JSON). |
| **Monitor** | Tela somente leitura para TV, em `/monitor/:codigo`. |

---

## 2. Stack e comandos

Monorepo npm workspaces dentro de `Kiwii/` (o repositório Git começa um nível acima).

- **Server**: Node ≥ 20, Express 4, Socket.io 4, `pg`, `ioredis`, `jsonwebtoken`, `helmet`,
  `express-rate-limit`, `express-validator`, `@supabase/supabase-js`. **CommonJS** (`require`).
- **Client**: React 18 + Vite, `socket.io-client`, `@supabase/supabase-js`, `lucide-react`,
  `html5-qrcode`, `qrcode.react`, `vite-plugin-pwa`. **ESM** (`import`). Estilo por *inline styles* +
  variáveis CSS em `client/src/styles/globals.css` (sem Tailwind/CSS-in-JS).
- **Auth**: Supabase Auth (e-mail/senha; magic link existe hoje, mas está marcado para remoção).
- **Banco**: PostgreSQL (Supabase). **Redis** é opcional em dev (cai para `Map` em memória).
- **Deploy**: Render (`render.yaml` na raiz): `Kiwii-server` (web, Node) e `Kiwii-client` (static).

```bash
cd Kiwii
npm install                 # instala server + client (workspaces; .npmrc usa legacy-peer-deps)
npm run dev                 # server :3001 + client :5173 (concurrently)
npm run dev:server | dev:client
npm run build               # build do client
npm run db:migrate          # roda server/migrations/*.sql  (ver armadilhas, seção 8)
npm test --workspace=server # jest (ver armadilhas: testes possivelmente desatualizados)
```

O Vite faz proxy de `/api` e `/socket.io` para `http://localhost:3001` em dev.

**Variáveis de ambiente** (apenas nomes — nunca registre valores):
- Server (`server/.env`): `PORT`, `NODE_ENV`, `CLIENT_URL`, `DATABASE_URL`, `REDIS_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `RATE_LIMIT_WINDOW_MS`,
  `RATE_LIMIT_MAX`, `OPERATION_MODE` (`cloud`|`hybrid`), `LOCAL_SERVER_LAN_URL`,
  `HEARTBEAT_INTERVAL_MS`, `CLOUD_SYNC_URL`.
- Client (`client/.env`): `VITE_SERVER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Não existe `.env.example`** apesar de README/`.gitignore` citarem. Se criar um, use placeholders.

---

## 3. Estrutura do repositório

```
tcc-controle_de_fila/            ← raiz do Git (render.yaml, AGENTS.md, CLAUDE.md)
└── Kiwii/
    ├── server/
    │   ├── index.js             ← Express + Socket.io + CORS + health (/health)
    │   ├── config.js            ← env + validação (exige vars críticas só em produção)
    │   ├── config/db.js         ← Pool pg + cliente Supabase (service_role) + verifySupabaseToken
    │   ├── config/redis.js      ← ioredis com fallback em memória (hoje NÃO usado pelos serviços)
    │   ├── middleware/          ← auth.js (requireAuth/requireRole/verifyToken/getOrgRole), rateLimiter, validateToken, requireStaffRole (órfão, sem uso)
    │   ├── routes/              ← auth.js, orgs.js, rooms.js, queue.js
    │   ├── services/            ← orgService (Postgres) | roomService, queueService (memória) | logService (Postgres: `audit_log`) | syncService
    │   ├── socket/handlers.js   ← todos os eventos em tempo real
    │   ├── migrations/          ← 001_initial_schema.sql + 002_audit_log.sql + run.js (o run.js não alcança a 002 em banco já migrado — ver seção 8)
    │   └── __tests__/           ← auth.test.js, queueService.test.js
    └── client/src/
        ├── App.jsx              ← máquina de estados de navegação (sessionStorage) + deep link do monitor
        ├── hooks/useAuth.jsx    ← sessão Supabase + JWT local offline + orgs + org ativa
        ├── lib/                 ← api.js (apiFetch), socket.js, supabase.js, export.js (CSV/JSON)
        ├── screens/             ← Landing, Auth, HostSetup, QueueManagement, ClientCheckin,
        │                          LiveTicket, Monitor, Members, OrgSetup
        └── components/          ← Modal, ConfirmModal, RecallModal, LogsModal, HistoryModal,
                                   CustomFieldInput, QRDisplay, OfflineBanner
```

---

## 4. Arquitetura — o que está onde (ponto mais importante)

O projeto tem **duas metades com maturidades diferentes**:

| Domínio | Armazenamento | Autenticação | Observação |
|---|---|---|---|
| Organizações, membros, convites, perfis | **PostgreSQL** (`orgService`) | Supabase JWT + `requireRole` (por `X-Org-Id`) | Completo e consistente |
| **Salas, filas, tickets, histórico** | **Memória do processo** (`Map` + array em `roomService`) | Supabase JWT: `requireAuth` + `requireRole`/`requireSameOrg` (REST); handshake autenticado + cargo por ação (Socket.io) | Perde tudo ao reiniciar; a sala **tem `orgId`** |
| **Auditoria de ações do staff** | **PostgreSQL** (`audit_log`, via `logService`, gravação sem `await`) | Leitura só para admin/owner | Criada pela migration 002 |

Consequências que um agente precisa ter em mente:
- As tabelas `rooms`, `tickets`, `session_reports` e `sync_log` **existem no schema, mas nenhum serviço as usa**
  (só `audit_log`, criada na migration 002, é usada — por `logService`).
- Uma sala **tem `orgId`**: `POST /rooms` o preenche a partir do `X-Org-Id` já verificado por `requireRole`. O cargo
  do operador **não é mais digitado**: vem de `org_members.role` na organização dona da sala (REST: `requireRole`;
  Socket.io: `verifyHostAccess` em `socket/handlers.js`). O antigo `staff_identity`/`X-Actor-*` foi removido.
- O histórico (`history`) é filtrado por organização, mas **continua em memória** (volátil).
- Várias prioridades abaixo (histórico persistente, dashboard, templates de fila) ainda exigem **persistir
  salas/tickets no Postgres** (a "base comum"; veja a seção 11).

### Ciclo de vida do ticket

```
waiting → called → served
        ↘ removed_by_host     (host removeu)
        ↘ left_voluntarily    (cliente saiu)
(ao encerrar o dia, quem ainda esperava vira "abandoned_queue_closed" só no relatório)
```
- `room.queue`: apenas `waiting`, sempre reordenada por **prioridade DESC → joinedAt ASC** (`recalcPositions`).
- `room.archive`: todo ticket que saiu da fila ativa (`called`, `served`, `removed_by_host`, `left_voluntarily`),
  nunca limpo durante o dia. "Em atendimento" = `archive` com `status === "called"`.
- `estimatedWait` = soma dos `tma` dos tickets à frente.
- Recall `counter`: vira `called` direto num guichê. Recall `queue_front`: volta a `waiting` com `joinedAt`
  ligeiramente anterior ao mais antigo da fila (fura a fila só dentro da própria prioridade).
- Ao entrar, `priority` e `tma` são **copiados** da categoria para o ticket (mudar a categoria depois não os recalcula).

### REST (prefixo `/api`)

| Rota | Auth | Função |
|---|---|---|
| `POST /auth/profile`, `GET /auth/me`, `POST /auth/accept-invite` | Bearer | Perfil, orgs do usuário, JWT local de 30 dias (offline) |
| `/orgs` (CRUD), `/orgs/:id/members`, `/orgs/:id/invites`, `/orgs/invites/accept` | Bearer + `requireRole` | Organizações, membros, convites |
| `POST /rooms` | Bearer + `requireRole("operator")` + rate-limit | Cria sala; `orgId` vem de `X-Org-Id` verificado |
| `GET /rooms/:code` | nenhuma | Info pública (check-in do cliente e Monitor; não expõe `orgId`) |
| `GET /rooms/:code/archive` | **nenhuma** (o front não usa) | Registro do dia |
| `GET /rooms/:code/logs` | Bearer + `requireRole("admin")` + `requireSameOrg` | Auditoria (lê `audit_log`) |
| `POST /rooms/:code/close` | Bearer + `requireRole("operator")` + `requireSameOrg` | Encerrar o dia |
| `GET /rooms/meta/history[/:id]` | Bearer + `requireRole("operator")` | Histórico **da organização** (em memória) |
| `POST /queue/join`, `GET /queue/:code` | nenhuma | Cliente entra; snapshot da fila |
| `GET /health`, `GET /api` | — | Health check / índice |

### Socket.io (eventos)

- Host → server: `host:join`, `host:call_next`, `host:call_specific`, `host:confirm_served`, `host:remove`,
  `host:priority`, `host:add_manual`, `host:recall`.
- Cliente → server: `client:join`, `client:leave`. Monitor → server: `monitor:join`.
- Server → sala (broadcast): `queue_update`, `archive_update`, `ticket_called`, `ticket_left`, `queue_empty`;
  `ticket_status` (só no `client:join`, para quem reconecta); `error`.
- **Autenticação (Fase 1):** o handshake lê `socket.handshake.auth.token` (Supabase ou JWT local, via `verifyToken`).
  Conexão **sem** token é aceita (cliente e Monitor não têm conta); token inválido vira anônimo. Todo evento `host:*`
  chama `verifyHostAccess`: exige usuário autenticado e, **a cada chamada**, cargo ≥ operador na organização dona da
  sala (`room.orgId` + `getOrgRole`). O `actor` (userId, nome do perfil, cargo) vem do token — `actorName`/`actorRole`
  no payload são ignorados. O client só emite `host:join` depois que `socket.auth.token` existe (`connectWithAuth`).


### Modo híbrido (cloud + fallback local)

`OPERATION_MODE=hybrid` liga `syncService` (heartbeat + `sync_log`). O endpoint de destino
`/api/sync/ingest` **não existe** no servidor; nada grava no `sync_log`. Recurso apenas esboçado.

---

## 5. Frontend — como funciona

- **Navegação sem router**: `App.jsx` guarda `screen` + `ctx` em `sessionStorage` (`kiwii_screen`, `kiwii_ctx`).
  Telas: `landing`, `auth`, `members`, `org-setup`, `host-setup`, `host-panel`, `client-checkin`, `live-ticket`.
  Deep link `/monitor/:codigo` ignora essa máquina e renderiza `MonitorScreen`.
- **Auth** (`useAuth`): sessão Supabase → `fetchMe()` → perfil + orgs; guarda JWT local (`kiwii_local_session`)
  para uso offline; org ativa em `localStorage` (`kiwii_active_org`). `apiFetch` injeta `Authorization` e
  `X-Org-Id`.
- **Telas do host exigem login e organização ativa** (o card "Painel do Host" redireciona para `auth`; sem organização,
  `HostSetupScreen` chama `onNeedOrg` e vai para `org-setup`; quem opera vem de `useAuth`, não de campo digitado);
  **cliente não precisa de conta**
  (recebe um `sessionToken` JWT de 8 h só para o ticket).
- **Tempo real**: telas assinam `socket` e re-emitem `*:join` no evento `connect` (necessário para reconexões).
- **Exportação**: `lib/export.js` gera CSV (`;` + BOM UTF-8) e JSON; colunas dos campos personalizados saem de
  `ticket.customDataEntries` (snapshot legível, criado no `joinQueue`).

---

## 6. Convenções do projeto

- **Idioma**: UI, mensagens de erro, comentários e commits em **português (pt-BR)**. Identificadores de código em inglês.
- **Commits**: `Tipo: descrição curta` — tipos já usados: `Feat`, `Fix`, `Update`, `UI`, `Teste`. Ex.: `Fix: Login move para a tela principal`.
- **Branches**: `main` (estável), `Teste-Daniel`, `mudar-css`; no remoto já existem `prioridade-alta`,
  `prioridade-media`, `prioridade-baixa` (uma por bloco da lista da seção 10). Prefira uma branch por item.
- **UI**: usar as variáveis CSS existentes (`--accent`, `--danger`, `--warn`, `--success`…) e as classes
  `.btn`, `.btn-primary`, `.card`, `.input`, `.tag`, `.mono`. **Sem emojis na interface** (foram removidos
  de propósito; ícones vêm de `lucide-react`). Confirmações destrutivas usam `components/ConfirmModal.jsx`.
- **Server**: rotas validam entrada com `express-validator` e delegam a *services*; erros de domínio são
  `throw new Error("mensagem em pt-BR")` capturados na rota/handler.
- **Prioridade numérica**: 3 = Alta, 2 = Média, 1 = Baixa (UI e banco).
- Nome do produto é **Kiwii**; restam vestígios de "fila.io" (manifest PWA, chaves `fila_io_*`, comentários) —
  não renomear chaves de storage sem migração, ou todos perdem a sessão.

---

## 7. Testes

Jest em `server/__tests__`. **Não foram executados na geração deste documento.** Pela leitura,
`queueService.test.js` mocka uma API assíncrona de `roomService` (`getCachedQueue`, `cacheQueue`, `getRoom` async)
que **não é a implementação atual** (síncrona, baseada em `Map`), então é provável que falhe. Rode `npm test`
antes de confiar neles e atualize-os junto com qualquer mudança em `queueService`/`roomService`.
Não há testes de cliente nem de socket.

---

## 8. Armadilhas e divergências conhecidas

1. **README desatualizado**: descreve `server/src/…`, estado 100 % em memória e "sem autenticação real". A estrutura
   real é `server/` plana, com Supabase Auth e orgs no Postgres.
2. **Cliente chama rotas que o servidor não tem**: `fetchOrgRooms` → `/api/rooms/org` e `fetchHistory` →
   `/api/rooms/history` (o servidor expõe `/api/rooms/meta/history`). O fluxo atual usa `apiFetch` direto nas telas.
3. **Migrations**: `run.js` reexecuta **todos** os `.sql` a cada execução e só ignora o erro `42P07`
   (tabela já existe). `001` usa `CREATE TYPE` sem `IF NOT EXISTS` (erro `42710`), então rodar de novo aborta. A
   `002_audit_log.sql` (idempotente) foi aplicada **manualmente** no SQL Editor do Supabase; o `run.js` continua sem alcançar
   migrations novas num banco já migrado (próxima: aplicar do mesmo jeito ou implementar `schema_migrations`). Ao criar migrations, escreva-as idempotentes ou
   adicione controle de versões aplicadas. Além disso, `run.js` carrega `dotenv` de `../.env` (relativo ao cwd)
   enquanto o env do servidor está em `server/.env` — confira. `npm run seed` aponta para `migrations/seed.js`, que não existe.
4. **Convites**: `orgService.inviteMember` grava o convite e tenta `supabase.auth.admin.inviteUserByEmail`; se falhar,
   apenas faz `console.warn` e a rota responde 201 — a UI mostra "Convite enviado" mesmo sem e-mail. Além disso,
   **nenhuma tela chama `acceptInvite`** (só existe em `lib/api.js`); o token só é guardado em `user_metadata`.
5. **`OrgSetupScreen`** só é alcançada quando um usuário logado **sem organização** abre o Painel do Host (`onNeedOrg`).
   A Landing cria/edita organizações por modais próprios.
6. **Tema único escuro**: `ThemeProvider`/`useTheme` foram removidos de vez (decisão do time); não reintroduza o toggle sem alinhar.
7. **Estado em memória**: reiniciar/dormir o servidor (plano free do Render) apaga salas, filas e histórico. Clientes
   com ticket ativo ficam com token válido para uma sala que não existe mais.
8. **Rate limit**: o global ignora `GET`; `joinQueueLimiter` está definido mas **não é usado** em `/queue/join`.
9. `render.yaml` cita `README-DEPLOY.md` e a pasta `fila-io/`, que não existem.
10. **Deploy (Render + Supabase)**: `DATABASE_URL` deve ser a string do **pooler** do Supabase — a conexão direta resolve para
    IPv6 e o Render responde `ENETUNREACH`. O `npm install` precisa de `legacy-peer-deps=true` (`.npmrc` em `Kiwii/`): o
    `@vitejs/plugin-react` não declara suporte ao Vite 8. Mudar o `name:` de um serviço no `render.yaml` não renomeia o
    serviço já existente nem a URL.
11. **Nunca use `fetch("/api/...")` relativo nas telas**: o proxy do Vite só existe em `npm run dev`; em produção a chamada
    cai no site estático (resposta vazia, erro de JSON). Use sempre `apiFetch` (`lib/api.js`).
12. **Testes**: `npm test --workspace=server` → 8 passam (`auth.test.js`); `queueService.test.js` tem 17 falhas
    **pré-existentes** (mocks assíncronos que não existem mais). Ao reportar, diga o que já falhava antes.
13. **Isolamento por organização**: toda rota/evento que opera sobre uma sala deve conferir que a sala pertence à org do
    usuário (REST: `requireSameOrg`; Socket.io: `verifyHostAccess`). `requireRole` sozinho só prova que o usuário é membro
    de *alguma* org.

### Achados de segurança (não estão na lista de prioridades — avise o time antes de mexer)

- **LGPD/privacidade**: `queue_update` envia a fila completa (nomes + `customData`, ex.: CPF) para **todos** na
  sala, inclusive outros clientes e o monitor. Clientes só deveriam receber o próprio ticket e a posição.
- ~~Criar sala, encerrar dia, logs, histórico e eventos `host:*` sem autenticação~~ — **resolvido na Fase 1** (REST com
  `requireAuth`/`requireRole`/`requireSameOrg`; Socket.io com handshake autenticado e cargo conferido por ação).
  **Ainda abertos**: `GET /rooms/:code/archive` e `/queue/*` não exigem auth (o front não usa o `archive`; `/queue/*` é do
  cliente anônimo, por desenho).
- O `zip` do projeto contém `server/.env` e `client/.env` com credenciais reais (service_role do Supabase,
  `DATABASE_URL`, `JWT_SECRET`). Não estão no Git, mas **devem ser rotacionadas** se o arquivo foi compartilhado.
- **Nunca** leia, imprima, copie ou comite valores de `.env`.

---

## 9. Regras para agentes

**Faça**
- Leia o código antes de assumir: este documento pode estar defasado em relação ao repositório.
- Faça mudanças pequenas e focadas, uma por item da lista de prioridades, em branch própria.
- Ao mexer em fila/ticket, mantenha: ordenação (prioridade → `joinedAt`), `recalcPositions` após toda mutação,
  `logAction` para toda ação do staff, e emissão de `queue_update`/`archive_update` após alterar estado.
- Ao criar um evento/endpoint novo, atualize a seção 4 deste arquivo.
- Escreva/atualize testes do `server` para regra de negócio nova.
- Marque o item concluído na seção 10 (`- [x]`) no mesmo commit.

**Não faça (sem pedir confirmação)**
- Alterar o schema do banco ou rodar migrations contra o banco real.
- Mudar o formato de `ticket`, `room` ou dos eventos Socket.io sem atualizar server **e** client (Live, Host, Monitor).
- Remover o tratamento de `code`/`access_token` na URL em `useAuth`: o mesmo mecanismo atende confirmação de
  cadastro, convites e recuperação de senha, não só o magic link.
- Adicionar dependências pesadas ou trocar a stack (React/Vite/Express/Supabase).
- Usar `localStorage`/`sessionStorage` com novas chaves sem seguir o padrão `fila_io_*`/`kiwii_*` existente.

---

## 10. Lista de prioridades (backlog do time)

Texto original da equipe, agrupado por prioridade e numerado para referência (`A` = alta, `M` = média,
`B` = baixa). As **"Pistas"** são observações da leitura do código para acelerar o início do trabalho; são
pontos de partida, não especificações — confirme no código antes de aplicar.

### Prioridade Alta

- [x] **A1 — Fila justa entre prioridades.** Regra de organização de fila: a cada X pessoas atendidas de prioridade mais alta, chamar X pessoas de prioridade média na hora de criar a sala, para que prioridades mais baixas sejam atendidas (quantidade customizável pelo dono da organização).
  *Pistas:* hoje `callNext` só faz `queue.shift()` de uma fila já ordenada por prioridade (`recalcPositions`). A regra precisa alterar a **ordem efetiva** (e portanto posição e `estimatedWait` exibidos ao cliente), não só quem o `callNext` escolhe. A configuração nasce na criação da sala (`HostSetupScreen` → `POST /rooms` → `createRoom`).

- [x] **A2 — Confirmação antes de encerrar o dia.** Botão de confirmação antes de finalizar o dia para evitar clique acidental e não permitir encerrar até a fila estar vazia (clientes atendidos ou removidos).
  *Pistas:* `QueueManagementScreen.handleCloseDay` chama `POST /rooms/:code/close` direto. `ConfirmModal` já existe. A trava de "fila vazia" deve ser **também no servidor** (`roomService.closeDay` hoje aceita fila com gente e marca como `abandoned_queue_closed`). Decidir: tickets `called` ainda não confirmados bloqueiam o encerramento? Depende de A8 (senão a fila nunca esvazia).

- [x] **A3 — E-mails de convite não são enviados.** Emails não estão sendo enviados para convidar membros para a organização (erro de rota no banco?).
  *Pistas (hipóteses a verificar):* o envio está em `orgService.inviteMember` dentro de `try/catch` que engole o erro (só `console.warn`) — veja os logs do servidor para o erro real do Supabase. Candidatas: usuário já cadastrado no Supabase (`inviteUserByEmail` falha), SMTP/URL de redirecionamento não configurados no projeto Supabase, ou falta `redirectTo`. Também não há tela que aceite o convite (`acceptInvite` sem uso). Tornar a falha visível na UI.

- [x] **A4 — Níveis de acesso (cargos).** Cargos (Dono, Administrador, Operador) com suas funcionalidades e definição de cargos por instituição; mostrar o cargo daquela instituição ao escolher no menu home; cargo definido pelo Dono ou Administrador.
  *Pistas:* cargos já existem em `org_members.role` + `requireRole` e na troca de org do `LandingScreen`. O que falta é **usar** isso nas salas/sockets: vincular sala a `org_id`, exigir `requireAuth`+`requireRole` em `/rooms/*` e autenticar o socket (ler `socket.handshake.auth.token`). Substituir `X-Actor-Role` pelo cargo real. Relaciona-se a M9.

- [x] **A5 — Funcionários como guichês na mesma fila.** Cada funcionário adicionado a uma instituição, após ter cargo definido, poderá ser designado como um guichê numa sessão: mais de um funcionário vendo a mesma fila em tempo real, cada um como um dos guichês definidos na criação.
  *Pistas:* guichê hoje é string (`room.counters[].name`) escolhida num `<select>`. Precisa vincular guichê ↔ usuário autenticado (ocupar/liberar), idealmente pelo socket autenticado. Depende de A4. Mesmo escopo de M7.

- [x] **A6 — Retirar o magic link.** Remover o login sem senha, só por e-mail.
  *Pistas:* `AuthScreen` (modo `magic`), `useAuth.signInWithMagicLink`. **Não** remover o tratamento de `code`/hash na URL de `useAuth.handleInitialSession`/`detectSessionInUrl` — também serve a confirmação de cadastro e convites.

- [x] **A7 — Novo menu principal pós-login.** Para o funcionário não precisar criar uma organização para entrar em outra à qual foi convidado: após o login, perguntar se criará uma instituição ou participará de alguma (conta nova, sem organizações); se já tiver organizações, poder trocar entre elas (se houver mais de uma) ou criar uma sala na instituição definida. Se o usuário já tem instituições e é convidado para uma nova, não aparece como botão no menu principal, e sim no menu da conta.
  *Pistas:* `OrgSetupScreen` já cobre "criar ou escolher", mas está inalcançável (ver seção 8, item 5). Hoje a troca de org fica no dropdown do topo do `LandingScreen`. Convites pendentes exigem endpoint de listagem e tela de aceite (relaciona-se a A3).

- [x] **A8 — Trancar a fila.** Funcionalidade de "trancar" a fila, impedindo novos usuários de entrarem, para não manter a fila aberta indefinidamente caso alguém tente entrar continuamente (e o funcionário não conseguir encerrar o dia porque a fila precisa estar vazia).
  *Pistas:* flag `room.locked`; checar em `queueService.joinQueue`/`POST /queue/join`; expor em `GET /rooms/:code` para a `ClientCheckinScreen` mostrar aviso; novo evento `host:lock`. Decidir se "adicionar manualmente" continua permitido com a fila trancada. Pré-requisito prático de A2.

### Prioridade Média

- [x] **M1 — Tela do cliente ao ser chamado de volta.** A tela do usuário tem que mostrar quando ele é chamado de volta para a fila.
  *Pistas:* em `LiveTicketScreen`, `terminalStatus` é definido (atendido/removido/saiu) e **nunca é limpo**; o bloco de estado terminal é renderizado antes de `isCalled`. Um recall (`queue_front` ou `counter`) não tira o cliente dessa tela. Junto com M3 e M8 é o mesmo problema de raiz.

- [x] **M2 — Modelo de fila persistente por instituição.** Mesmo selecionando a mesma instituição, as opções de categoria sempre reiniciam. Guardar essas configurações da fila no banco: menu de customização na instituição, e o botão "criar sala" só carrega esse modelo.
  *Pistas:* `HostSetupScreen` inicia com estado fixo (`Atendimento`, `Guichê 1`). Precisa de tabela/coluna de template por organização (categorias, guichês, campos personalizados e, no futuro, regras de A1/M5). Ver armadilha das migrations (seção 8, item 3).

- [x] **M3 — Atualizar status sem F5.** Atualizar automaticamente o status da pessoa, sem precisar do F5, quando ela é atendida e chamada para a fila novamente.
  *Pistas:* o servidor só envia `ticket_status` individual no `client:join` (ou seja, no F5). `host:confirm_served`/`host:remove` emitem apenas `archive_update`, que o `LiveTicketScreen` **não escuta**; recall `queue_front` emite só `queue_update`. Solução provável: emitir `ticket_status` ao cliente dono do token a cada mudança e tratar no cliente (limpando `terminalStatus`).

- [x] **M4 — Histórico de dias passados.** Função de histórico para ver dias passados, quantos foram atendidos e reacessar o arquivo exportável (implementar junto com o dashboard de dias passados — M6).
  *Pistas:* o histórico hoje é um array global em memória (`roomService.history`), sem filtro por org e perdido ao reiniciar. Exige persistência (`session_reports` só guarda totais; os tickets precisam ser salvos para regerar o CSV/JSON) e escopo por organização.

- [x] **M5 — Prioridade automática por campos personalizados.** Auto-designar prioridade com base nos campos personalizados, customizável pelo Dono e Admin e podendo ser ativada ou não (ex.: se idade > 60, prioridade = Alta; tudo definido como customização pelo dono).
  *Pistas:* a prioridade vem da categoria em `joinQueue` (`catConfig.priority`). Regras (campo, operador, valor → prioridade) seriam avaliadas ali, sobre `customData`. Depende de B2 para o caso "data de nascimento" e de M2 para persistir as regras por organização.

- [x] **M6 — Dashboard para o host.** Dashboard dos últimos dias e sessões.
  *Pistas:* depende da persistência de M4. `HistoryModal` já compara sessão com a anterior (▲/▼) e pode ser ponto de partida.

- [x] **M7 — Membros na mesma fila com guichês diferentes.** Todos os membros da organização na mesma fila, com guichês diferentes (ex.: pessoa 1 – guichê 1, pessoa 2 – guichê 2…).
  *Pistas:* mesmo escopo de A5; tratar como um único trabalho.

- [x] **M8 — Recall não aparece no menu principal do cliente.** Chamar a pessoa de volta não mostra nada no menu principal dela; não é possível ver a mudança sem reentrar na fila.
  *Pistas:* relacionado a M1/M3. Considerar também `ctx.ticket` guardado em `sessionStorage` (`kiwii_ctx`): a tela inicial do cliente não sabe que há um ticket ativo.

- [x] **M9 — Conta e cargo guardados automaticamente.** Guardar a conta que acessa a instituição e seu cargo para que o funcionário não escolha o cargo manualmente ao abrir a sala.
  *Pistas:* remover os campos "Seu Nome"/"Cargo" da `HostSetupScreen` e derivar `actor` do usuário autenticado + `activeOrg.role` (via token verificado no servidor, não por header). Ver A4.

### Prioridade Baixa

- [ ] **B1 — Login e cadastro offline.** Login e criar conta não funcionam sem internet (mesmo sistema de sync quando a internet voltar?).
  *Pistas:* já existe sessão local JWT de 30 dias (`issueLocalSession`, `loadFromLocalSession`) e PWA (`vite-plugin-pwa`), mas ela depende de o **servidor** responder. O sync híbrido está só esboçado (seção 4). Escopo grande; avaliar viabilidade e segurança antes (cadastro offline cria conta onde?).

- [ ] **B2 — Campo personalizado do tipo data.** Adicionar o tipo "data" como campo personalizado (ex.: data de nascimento).
  *Pistas:* tocar `FIELD_TYPES` (`HostSetupScreen`), `CustomFieldInput`, validação de obrigatório em `joinQueue` e `export.js`.

- [ ] **B3 — Interface mobile / outros dispositivos.** Como integrar o programa em dispositivos diferentes.
  *Pistas:* o cliente já é PWA e o check-in do cliente é pensado para celular, mas as telas do host usam grades com colunas fixas em *inline styles* (sem media queries). Definir o alcance (host no celular? app nativo?) antes de começar.

- [ ] **B4 — Aviso ao sair da fila depois de ser chamado de volta.** Mensagem de aviso caso o usuário tente sair da fila após ser chamado novamente.
  *Pistas:* `LiveTicketScreen` já usa `ConfirmModal` para sair; falta texto específico para o estado "chamado de volta" (depende de M1).

- [ ] **B5 — Transferir a posse da instituição.** O dono pode transferir a posse para outro usuário (ex.: um TI monta a sala e entrega ao dono real do estabelecimento).
  *Pistas:* `orgService.updateMemberRole` aceita `owner`, mas não rebaixa o dono anterior, a rota exige só `admin` e a UI esconde a edição de donos. Fazer fluxo explícito e transacional (promover novo + rebaixar antigo) com confirmação.

- [ ] **B6 — Layout logado ≠ layout deslogado.** O layout com sessão não pode ser idêntico (exceto o "Olá, e-mail") ao layout sem sessão/conta.
  *Pistas:* `LandingScreen` renderiza os mesmos cards para ambos os estados.

- [ ] **B7 — Categoria ao chamar de volta (opcional).** Ao chamar a pessoa de volta, poder alterar a categoria ou aplicar automaticamente uma (ex.: "Retorno").
  *Pistas:* `RecallModal` + `queueService.recallTicket`. Lembrar que `priority`/`tma` do ticket são cópias da categoria e precisam ser recalculados ao trocar.

### Agrupamentos e ordem sugerida

- **Base comum (fazer primeiro):** persistir salas/tickets/histórico no Postgres e vincular a sala à organização →
  destrava A4, A5/M7, M2, M4/M6, M9.
- **Mesmo problema de raiz:** M1 + M3 + M8 (cliente não percebe mudanças de status/recall) → depois B4.
- **Mesmo trabalho:** A5 + M7; M4 + M6; A4 + M9.
- **Encadeados:** A8 antes de A2; A3 antes da parte de convites de A7; B2 antes do exemplo de idade em M5; M2 antes de persistir regras de A1/M5.
- **Itens independentes e pequenos (bons para começar):** A6, A2 (parte do `ConfirmModal`), B2, B6.

---

## 11. Estado atual e próximos passos (handoff após a Fase 1)

**Entregue na Fase 1** (código aplicado pelo time; migration 002 rodada no Supabase):
- Criar/gerenciar sala exige login **e** organização; a sala guarda `orgId`; cargo real vem de `org_members.role`.
- Socket.io com handshake autenticado + `verifyHostAccess` por ação (`host:*`); payload `actorName/actorRole` ignorado.
- `audit_log` no Postgres (`logService`, fire-and-forget) com identidade real; Logs só para admin/owner.
- Histórico filtrado por organização; `requireSameOrg` impede acesso cruzado entre organizações.
- Enum `ticket_status` ganhou `removed_by_host` e `left_voluntarily` (valores antigos `removed`/`abandoned` ficam sem uso).
- Telas com redesign (sem emoji, tema único escuro) restauradas após um merge que as tinha regredido.

**Validação feita:** 24 testes de integração (Express + Socket.io reais, Postgres local, sessão local assinada) cobrindo
anônimo, token inválido, operador da org dona, de outra org, sem vínculo, cargo falsificado, acesso cruzado e `audit_log`.
**Não validado:** token real do Supabase e o fluxo no navegador — confirme ao testar.

**Pendente:**
1. Itens da seção 10 que **não** dependem de persistir salas (17): A1, A2, A3, A6, A7, A8, M1, M3, M5, M8, B1–B7.
   Fazer primeiro (decisão do time: priorizar funcionalidades).
2. Itens que dependem da base comum (A4/M9 — completar o que faltar além do cargo real —, A5, M7, M2, M4, M6): exigem a
   **Fase 2** — persistir `rooms`/`tickets`/`session_reports` no Postgres mantendo a interface pública de
   `roomService`/`queueService` (e, se útil, Redis via `config/redis.js` para o estado ativo). Alteração de banco: pedir aprovação.
3. **Fase 3**: atualizar `render.yaml` e escrever o guia de deploy (itens 9–10 da seção 8).
4. Controle de versões de migrations no `run.js` (`schema_migrations`) — pedir aprovação.
5. Limpeza: remover `middleware/requireStaffRole.js` (sem uso); rotacionar as chaves do Supabase compartilhadas no ZIP antigo.

Regras de trabalho: seguir o `CLAUDE.md` (plano e aprovação antes de mexer em banco/auth/formato de eventos; não abrir `.env`;
sem commit/push sem pedido; responder em pt-BR).