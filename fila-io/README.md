# ⚡ fila.io v2.0

> Gestão de Filas em Tempo Real — Cloud-first com Fallback Local

Projeto de TCC — UniSãoJosé 2026.2

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    MODO CLOUD (padrão)                  │
│                                                         │
│   Cliente (navegador)                                   │
│       │ HTTPS + WSS                                     │
│       ▼                                                 │
│   Supabase Auth ──► Express + Socket.io ──► Redis       │
│                              │                          │
│                              ▼                          │
│                         PostgreSQL                      │
│                       (Supabase DB)                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  MODO HÍBRIDO (opcional)                │
│                                                         │
│   Clientes na LAN ──► Servidor Local ──► Redis Local    │
│                              │                          │
│                              │ heartbeat (10s)          │
│                              ▼                          │
│                         Cloud API                       │
│                    (sync quando online)                 │
└─────────────────────────────────────────────────────────┘
```

### Stack

| Camada       | Tecnologia                     |
|--------------|--------------------------------|
| Auth         | Supabase Auth (magic link / e-mail + senha) |
| Banco        | PostgreSQL (Supabase ou self-hosted) |
| Cache / Fila | Redis (Upstash em prod, fallback in-memory em dev) |
| Realtime     | Socket.io (WebSocket, fallback polling) |
| API          | Express.js + express-validator |
| Frontend     | React + Vite                   |

### Roles

| Role       | Pode                                            |
|------------|-------------------------------------------------|
| `owner`    | Tudo — incluindo deletar org e transferir ownership |
| `admin`    | Convidar membros, alterar roles, criar/fechar salas, ver relatórios |
| `operator` | Criar salas, operar fila (chamar, remover, priorizar) |

---

## Instalação

### Pré-requisitos

- Node.js >= 18
- Redis (opcional em dev — usa fallback em memória automaticamente)
- Conta Supabase (gratuita em [supabase.com](https://supabase.com))

### 1. Clone e instale dependências

```bash
git clone https://github.com/seu-usuario/fila-io.git
cd fila-io
npm install          # instala workspace root + server + client
```

### 2. Configure o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute o arquivo `server/migrations/001_initial_schema.sql`
3. Em **Settings → API**, copie:
   - Project URL → `SUPABASE_URL` e `VITE_SUPABASE_URL`
   - `anon` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (apenas no servidor)
4. Em **Authentication → Settings**, configure:
   - Site URL: `http://localhost:5173` (dev) ou seu domínio em prod
   - Habilite **Email** como provider

### 3. Configure as variáveis de ambiente

```bash
# Variáveis do servidor
cp .env.example .env
# Edite .env com suas credenciais

# Variáveis do cliente (Vite)
cp .env.example client/.env
# Edite client/.env — apenas as variáveis com prefixo VITE_
```

Variáveis mínimas para funcionar:

```env
# .env (servidor)
DATABASE_URL=postgresql://postgres:senha@db.xxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=gere_com_openssl_rand_hex_64

# client/.env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SERVER_URL=http://localhost:3001
```

### 4. Execute as migrations

```bash
npm run db:migrate
```

### 5. Inicie em desenvolvimento

```bash
npm run dev
# Servidor em http://localhost:3001
# Cliente em  http://localhost:5173
```

---

## Modo Híbrido (Cloud + Fallback Local)

Para estabelecimentos que precisam operar sem internet:

```env
OPERATION_MODE=hybrid
LOCAL_SERVER_LAN_URL=http://192.168.1.100:3001
HEARTBEAT_INTERVAL_MS=10000
CLOUD_SYNC_URL=https://api.fila.io
```

O servidor local:
1. Faz heartbeat para a cloud a cada 10 segundos
2. Se perder conexão → opera de forma autônoma (dados no Redis + PostgreSQL local)
3. Quando a internet volta → drena o `sync_log` para a cloud automaticamente

Os clientes se conectam normalmente via Wi-Fi do estabelecimento.

---

## Estrutura do Projeto

```
fila-io/
├── server/
│   ├── config/
│   │   ├── db.js          # PostgreSQL pool + Supabase admin client
│   │   └── redis.js       # Redis com fallback em memória
│   ├── middleware/
│   │   ├── auth.js        # requireAuth + requireRole
│   │   ├── rateLimiter.js
│   │   └── validateToken.js  # JWT de ticket de fila
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── run.js
│   ├── routes/
│   │   ├── auth.js        # /api/auth
│   │   ├── orgs.js        # /api/orgs
│   │   ├── rooms.js       # /api/rooms
│   │   └── queue.js       # /api/queue
│   ├── services/
│   │   ├── orgService.js
│   │   ├── roomService.js
│   │   ├── queueService.js
│   │   └── syncService.js # Modo híbrido
│   ├── socket/
│   │   └── handlers.js
│   ├── config.js
│   └── index.js
│
└── client/
    └── src/
        ├── hooks/
        │   └── useAuth.jsx    # Context de autenticação
        ├── lib/
        │   ├── api.js         # Fetch autenticado centralizado
        │   ├── socket.js
        │   ├── supabase.js
        │   └── export.js
        ├── screens/
        │   ├── AuthScreen.jsx
        │   ├── OrgSetupScreen.jsx
        │   ├── LandingScreen.jsx
        │   ├── HostSetupScreen.jsx
        │   ├── QueueManagementScreen.jsx
        │   ├── ClientCheckinScreen.jsx
        │   ├── LiveTicketScreen.jsx
        │   └── MembersScreen.jsx
        ├── components/
        │   ├── Modal.jsx
        │   └── QRDisplay.jsx
        ├── styles/globals.css
        └── App.jsx
```

---

## API Reference

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/profile` | Cria/atualiza perfil após login |
| `GET`  | `/api/auth/me` | Retorna usuário + orgs |
| `POST` | `/api/auth/accept-invite` | Aceita convite de organização |

### Organizations
| Método   | Rota | Role mínimo |
|----------|------|-------------|
| `POST`   | `/api/orgs` | autenticado |
| `GET`    | `/api/orgs` | autenticado |
| `GET`    | `/api/orgs/:id` | operator |
| `PATCH`  | `/api/orgs/:id` | admin |
| `GET`    | `/api/orgs/:id/members` | operator |
| `PATCH`  | `/api/orgs/:id/members/:uid` | admin |
| `DELETE` | `/api/orgs/:id/members/:uid` | admin |
| `POST`   | `/api/orgs/:id/invites` | admin |

### Rooms
| Método | Rota | Auth |
|--------|------|------|
| `POST` | `/api/rooms` | operator |
| `GET`  | `/api/rooms/org` | operator |
| `GET`  | `/api/rooms/:code` | público |
| `GET`  | `/api/rooms/history` | operator |
| `POST` | `/api/rooms/:code/close` | operator |

### Queue
| Método | Rota | Auth |
|--------|------|------|
| `POST` | `/api/queue/join` | público |
| `GET`  | `/api/queue/:code` | operator |

---

## Licença

MIT © 2026 Erick Serique Heeren de Oliveira
