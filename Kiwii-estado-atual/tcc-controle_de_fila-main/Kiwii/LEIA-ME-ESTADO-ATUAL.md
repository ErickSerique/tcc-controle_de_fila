# Kiwii — estado atual (INCOMPLETO) — leia antes de usar

Pacote com o projeto inteiro + alterações feitas até agora. **Não há migration de banco
nova** (as salas vivem em memória). Reinicie o servidor depois de copiar.
Salas criadas antes dessa versão não têm organização e serão recusadas — crie uma nova.

## ✅ Pronto no BACKEND (lógica testada por script; rotas só com checagem de sintaxe)
- **Cargo real**: `requireRoomStaff` / `io.use` usam o JWT + `org_members`. Acabou o `x-actor-role` forjável.
- **Sala vinculada à organização** (`room.orgId`). `POST /api/rooms` exige header `X-Org-Id`.
- **Fila intercalada (#1)**: `priorityBatchSize` na criação da sala (0 desliga). Testado.
- **Encerrar dia (#2)**: o servidor RECUSA enquanto houver gente na fila ou em atendimento. Testado.
- **Trancar fila (#8)**: socket `host:toggle_lock {roomCode, locked}` ou `PATCH /api/rooms/:code/lock`;
  `GET /api/rooms/:code` devolve `locked`; `joinQueue` bloqueia (entrada manual do host passa). Testado.
- **Guichês (#5)**: socket `host:claim_counter {roomCode, counterId}`; chamadas usam o guichê
  reivindicado; colisão bloqueada; libera ao desconectar. Eventos: `you_are`, `counters_update`,
  `room_status`. Lista de salas ativas: `GET /api/rooms/org/active` (header `X-Org-Id`).
- **Convites (#3/#7)**: `POST /api/orgs/:id/invites` agora devolve `link`, `emailSent`, `emailError`;
  aceite só pelo e-mail convidado e nunca rebaixa cargo; `GET /api/orgs/invites/:token` (prévia pública);
  `GET /api/auth/my-invites` (convites pendentes do usuário); `POST /api/auth/accept-invite`.
- **Hierarquia (#4)**: só o Dono altera/remove outro Dono. Histórico filtrado por organização.
- Provável causa do e-mail não chegar: o Supabase não envia convite para quem JÁ tem conta, e a cota
  gratuita de e-mails é baixa. Por isso o `link` agora é sempre devolvido.

## ✅ Pronto no FRONT (só sintaxe conferida, não rodei no navegador)
- `lib/api.js` (novas funções), `RecallModal.jsx`, `HostSetupScreen.jsx` (usa conta real + `X-Org-Id`,
  campo "Regra de Prioridade", sem seletor de cargo).

## ❌ NÃO feito no front — o que ainda quebra
1. **`QueueManagementScreen.jsx` NÃO foi atualizado**:
   - sala com **mais de 1 guichê**: "Chamar próximo" falha ("Escolha um guichê"), pois falta a tela que
     emite `host:claim_counter`. Sala com **1 guichê** funciona (reivindicado automaticamente).
   - botão **Histórico** quebra (a rota agora exige `X-Org-Id`): use `apiFetch(path, { orgId: room.orgId })`.
   - faltam: botão de **trancar fila**, **modal de confirmação** ao encerrar, ler `you_are`/`counters_update`.
   - ainda manda `actorName/actorRole` no `host:join` (o servidor ignora, sem problema).
2. **Magic link (#6)** ainda existe em `AuthScreen.jsx` / `useAuth.jsx`.
3. **Menu inicial (#7)**: `LandingScreen`, `OrgSetupScreen`, tela de **Aceitar Convite**, rota `/invite/:token`
   e lista de salas ativas — **não feitos**. `MembersScreen` ainda não mostra o link do convite.
4. `ClientCheckinScreen`: ainda não avisa "fila trancada" (o servidor já recusa com erro).
5. **Nada foi testado com o seu Supabase/Postgres reais.**

## Como terminar
Os contratos acima já estão no servidor; falta só consumir no front.
