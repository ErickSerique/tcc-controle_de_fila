# Kiwii — Lista de Prioridades (Concluídas)

Todas as prioridades abaixo foram mescladas, implementadas e testadas com 100% de cobertura no repositório.

1. **Prioridade 1: Intercalação de Prioridades Customizável**
   - Regra `batchSize` em `priorityRule`.
   - Se configurado, a cada `batchSize` atendimentos de alta prioridade, o sistema atende o mesmo lote de prioridade média antes de retornar para alta.
   - Configurável na criação da sala (`HostSetupScreen.jsx`) ou `0` para desativar (ordenação padrão).

2. **Prioridade 2: Proteção de "Encerrar Dia"**
   - Modal de confirmação na interface de gerenciamento.
   - O servidor e o cliente validam se ainda há clientes na fila (`waiting`) ou em atendimento (`called`).
   - Se houver clientes pendentes, o encerramento é impedido com erro explicativo (`400`).

3. **Prioridade 3: Convites de Membros com Link Direto**
   - Ao convidar um operador/admin na tela de membros, o sistema expõe imediatamente um link compartilhável copiável (`/invite/:token`).
   - Tela pública de aceite (`InviteScreen.jsx`) e rota nominal `/accept-invite`.
   - Notificação visual caso o envio por e-mail do Supabase falhe devido à cota SMTP.

4. **Prioridade 4: Níveis Reais de Acesso (RBAC)**
   - Hierarquia no banco: `owner` (3) > `admin` (2) > `operator` (1).
   - Somente `owner` pode alterar cargos de outros proprietários ou transferir titularidade da organização.
   - Validação em middleware via banco de dados (`org_members`).

5. **Prioridade 5: Multi-Guichê (Counter Claiming)**
   - Múltiplos atendentes podem operar a mesma fila simultaneamente em guichês distintos.
   - Reivindicação de guichê via WebSocket com prevenção de colisão e liberação automática ao desconectar.
   - Listagem de sessões ativas na tela inicial para operadores entrarem direto no atendimento.

6. **Prioridade 6: Remoção do Magic Link**
   - Autenticação padronizada exclusivamente para Email e Senha.
   - Remoção do fluxo sem senha na UI e no hook `useAuth`.

7. **Prioridade 7: Onboarding Fluido (0 Organizações)**
   - Se o usuário não possui organizações, não é forçado a criar uma: pode optar por criar ou aceitar convites pendentes detectados pelo seu e-mail.
   - Modal de convites pendentes e alternância rápida de instituição.

8. **Prioridade 8: Trancar Fila**
   - O anfitrião pode trancar/destrancar a fila a qualquer momento.
   - Quando trancada, o QR Code de check-in bloqueia novas emissões de senhas para clientes, exibindo alerta explicativo.
   - Entradas manuais por operadores continuam permitidas.
