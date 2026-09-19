# ⚡ Kiwii — Real-Time Queue Management SaaS

MVP de gestão de filas em tempo real com Socket.io, React e Node.js.

---

## Estrutura do Projeto

```
queue-saas/
├── package.json                  ← root (npm workspaces + concurrently)
├── README.md
│
├── server/                       ── Backend Node.js ──────────────────
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js              ← Entry point: Express + Socket.io
│       ├── config/
│       │   └── index.js
│       ├── routes/
│       │   ├── rooms.js          ← rooms, archive, logs, close, history
│       │   └── queue.js          ← join, get queue
│       ├── middleware/
│       │   ├── rateLimiter.js
│       │   ├── validateToken.js
│       │   └── requireStaffRole.js   ← gate de owner/admin p/ logs
│       ├── services/
│       │   ├── roomService.js    ← CRUD + algoritmo de previsão + histórico
│       │   ├── queueService.js   ← ciclo de vida completo do ticket
│       │   └── logService.js     ← auditoria (quem fez o quê e quando)
│       └── socket/
│           └── handlers.js       ← todos os eventos Socket.io
│
└── client/                       ── Frontend React ───────────────────
    ├── package.json
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx               ← navegação + deep link /monitor/:code
        ├── styles/globals.css
        ├── lib/
        │   ├── socket.js
        │   └── export.js         ← CSV/JSON com status + campos custom
        ├── components/
        │   ├── QRDisplay.jsx
        │   ├── Modal.jsx
        │   ├── ConfirmModal.jsx      ← confirmação genérica (sair da fila...)
        │   ├── CustomFieldInput.jsx  ← campo dinâmico de check-in
        │   ├── RecallModal.jsx       ← chamar de volta (guichê/fila)
        │   ├── LogsModal.jsx         ← auditoria (owner/admin)
        │   └── HistoryModal.jsx      ← sessões passadas + exportação
        └── screens/
            ├── LandingScreen.jsx
            ├── HostSetupScreen.jsx        ← + identidade, guichês, campos custom
            ├── ClientCheckinScreen.jsx    ← + campos dinâmicos
            ├── LiveTicketScreen.jsx       ← + guichê, sair da fila
            ├── QueueManagementScreen.jsx  ← + registro do dia, recall, logs
            └── MonitorScreen.jsx          ← painel para TV externa (novo)
```

---

## Quick Start

```bash
npm run install:all
cp server/.env.example server/.env
npm run dev
# SERVER → http://localhost:3001
# CLIENT → http://localhost:5173
```

---

## Funcionalidades desta versão

### 1. Histórico de sessões
Cada "Encerrar Dia" arquiva um relatório completo (`GET /api/rooms/meta/history`).
No painel do host, o botão **📊 Histórico** abre uma lista de sessões passadas com
comparação automática (▲/▼) contra a sessão anterior da mesma sala, e exportação
individual em CSV/JSON por sessão.

### 2. Logs de auditoria (owner/admin)
Toda ação do staff (chamar, remover, readmitir, encerrar o dia...) é registrada com
quem fez, quando e o quê (`roomService` → `logService.logAction`). O botão **📜 Logs**
só aparece para quem se identificou como Owner ou Admin ao criar a sala.

> ⚠️ **Importante**: como o projeto ainda não tem autenticação real (JWT/banco), a
> identidade do operador é uma "identificação leve" — nome + cargo informados no
> `HostSetupScreen` e guardados em `sessionStorage`. Isso já habilita toda a
> funcionalidade de auditoria e controle de tela, mas **tecnicamente pode ser
> falsificada** (o cargo viaja em um header HTTP `X-Actor-Role`). Antes de produção,
> troque a origem da role para um JWT assinado (ex: Supabase Auth) — o resto do
> sistema (logs, permissões) já está pronto para receber isso sem mudanças estruturais.

### 3. Ciclo de vida completo do ticket + Chamar de Volta
Todo ticket que sai da fila ativa (atendido, removido pelo host, ou saiu pelo próprio
celular) vai para `room.archive` com status explícito:

```
waiting → called → served
        ↘ removed_by_host    (host clicou em remover)
        ↘ left_voluntarily   (cliente clicou "Sair da Fila")
```

A seção **📋 Registro do Dia** mostra todos com uma coluna de Status
(✅ Atendido / ❌ Removido / 🚪 Saiu) e um botão **🔁 Chamar de Volta** que abre
um modal com duas opções:
- **Direto ao guichê** — pula a fila, vai para "Em Atendimento"
- **Voltar ao início da fila** — reentra respeitando a prioridade original da categoria

### 4. Guichês personalizáveis
Em `HostSetupScreen`, o host define quantos guichês quiser com o nome que preferir
("Balcão 1", "Guichê Preferencial", "Caixa Rápido"...). Ao chamar um cliente, o host
escolhe o guichê num seletor — o nome aparece na tela do cliente e no Monitor externo.

### 5. Campos personalizados de check-in
Além do nome, o host pode adicionar campos extras (texto, número, seleção ou sim/não)
com a opção de marcar como obrigatório — ex: CPF, telefone, alergias. Esses campos
aparecem dinamicamente no check-in do cliente (`ClientCheckinScreen`) e no modal de
adição manual do host, e são incluídos automaticamente na exportação CSV/JSON.

### 6. Visualização melhorada + Monitor externo
- `LiveTicketScreen` ganhou barra de progresso visual, contagem de "quantos faltam
  na sua categoria" e exibição do guichê designado ao ser chamado.
- Nova tela **MonitorScreen**, pensada para rodar em tela cheia numa TV/monitor do
  estabelecimento: mostra "Chamando Agora" (nome + guichê) e "Próximos a Serem
  Chamados", atualizando em tempo real via Socket.io.
  Acesse em: `http://localhost:5173/monitor/CODIGODA SALA`
  (ou clique em **📺 Monitor** no painel do host, que abre em nova aba)

---

## Fluxo de Telas

```
LandingScreen
├── [Sou Host]    → HostSetupScreen → QueueManagementScreen
└── [Sou Cliente] → ClientCheckinScreen → LiveTicketScreen

/monitor/:roomCode → MonitorScreen (deep link, sem login, somente leitura)
```

---

## Eventos Socket.io

### Host → Server
| Evento               | Payload                                             |
|-----------------------|------------------------------------------------------|
| `host:join`           | `{ roomCode, actorName, actorRole }`                 |
| `host:call_next`      | `{ roomCode, counter }`                              |
| `host:call_specific`  | `{ roomCode, token, counter }`                       |
| `host:confirm_served` | `{ roomCode, token }`                                |
| `host:remove`         | `{ roomCode, token }`                                |
| `host:priority`       | `{ roomCode, token, priority }`                      |
| `host:add_manual`     | `{ roomCode, name, category, customData }`           |
| `host:recall`         | `{ roomCode, token, mode: 'counter'|'queue_front', counter }` |

### Cliente → Server
| Evento          | Payload                   |
|-----------------|----------------------------|
| `client:join`   | `{ roomCode, token }`      |
| `client:leave`  | `{ roomCode, token }`      |

### Monitor → Server (somente leitura)
| Evento           | Payload           |
|-------------------|--------------------|
| `monitor:join`    | `{ roomCode }`     |

### Server → Room (broadcast)
| Evento            | Payload                             |
|--------------------|--------------------------------------|
| `queue_update`     | `{ roomCode, queue }`                |
| `archive_update`   | `{ roomCode, archive }`              |
| `ticket_called`     | `{ roomCode, token, ticket }`        |
| `ticket_left`       | `{ roomCode, token }`                |
| `queue_empty`       | `{ roomCode }`                       |

---

## Algoritmo de Fila Priorizada

```
Ordenação: prioridade DESC → joinedAt ASC (FIFO dentro da mesma prioridade)

T_est(ticket_i) = Σ TMA(ticket_j)  para todo j com position < i
```

Ao "voltar para o início da fila" via recall, o `joinedAt` do ticket é ajustado para
ficar levemente anterior ao mais antigo já na fila — isso garante que ele entre na
frente de todos os outros **dentro da própria prioridade**, sem furar a fila de um
ticket de prioridade mais alta que já esteja esperando.

---

## Segurança

| Mecanismo                | Implementação                                      |
|---------------------------|------------------------------------------------------|
| Rate limiting global      | `express-rate-limit` — 20 req/15min por IP           |
| Rate limiting criação     | 5 salas/hora por IP (`createRoomLimiter`)             |
| Anti-SQL Injection        | `express-validator` com `.escape()` em todo input    |
| Token de sessão           | JWT assinado com roomCode — impede cross-sala         |
| Payload flooding          | `express.json({ limit: "10kb" })`                    |
| Headers seguros           | `helmet()`                                            |
| Gate de logs              | `requireOwnerOrAdmin` — ver aviso na seção "Logs" acima |

---

## Variáveis de Ambiente (server/.env)

```env
PORT=3001
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@host:5432/fila_io
JWT_SECRET=<64 chars hex>
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=20
```

---

## Próximos passos sugeridos

1. **Autenticação real** — trocar a identificação leve de staff por Supabase Auth
   (JWT assinado), mantendo a mesma estrutura de `actor.role` já usada em `logService`
   e `requireStaffRole`.
2. **Persistência** — mover `rooms`/`history` do Map em memória para PostgreSQL,
   mantendo o Redis apenas como cache da fila ativa (< 200ms).
3. **Cloud-first com fallback local** — conforme discutido, um servidor local (Raspberry
   Pi + SQLite) sincroniza com a cloud via heartbeat quando a internet do
   estabelecimento cai.

## Stack Tecnológica

| Camada      | Tecnologia                                       |
|-------------|---------------------------------------------------|
| Frontend    | React 18 + Vite + CSS Variables                    |
| Real-time   | Socket.io 4 (client + server)                      |
| Backend     | Node.js + Express 4                                |
| Auth        | JWT (jsonwebtoken) — placeholder para Supabase Auth |
| Segurança   | helmet + express-rate-limit + express-validator    |
| QR Code     | html5-qrcode (câmera) + SVG customizado            |
| Exportação  | CSV nativo + JSON                                   |
| DB (prod)   | Redis (filas) + PostgreSQL (histórico)             |
