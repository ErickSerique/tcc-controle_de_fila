# Lista de Prioridades — Projeto Kiwii

> Status atualizado em 2026-11-20

---

- [x] **Aumentar a regra de prioridade intercalada de média para baixa também (configurável)**
  - *Implementado:* Cascata de prioridade configurável (`highBatchSize` e `medBatchSize`) em `roomService.js` e na interface de `HostSetupScreen.jsx`. ✅

- [x] **Após criar a sala uma primeira vez como admin, criar outro botão para menu de configuração específica da sala da instituição e o botão de criar sala cria automaticamente uma sala após a primeira configuração**
  - *Implementado:* Salas salvas permanentes permitem abrir o dia com 1 clique ("Iniciar Dia"). Adicionado botão direto "Configurar" em cada sala cadastrada para que administradores possam editar configurações (guichês, categorias, campos) sem recriar a sala do zero. ✅

- [x] **Tratamento de 2 ou mais operadores em sala com 1 guichê (aviso na tela de início)**
  - *Implementado:* A tela inicial (`LandingScreen.jsx`) detecta guichês ocupados (`isFull`). Ao clicar em uma sala com guichês esgotados, exibe modal de aviso informando por quem o guichê já está em uso e oferece entrada apenas como visualizador. ✅

- [x] **Correção do bug de atendimento quando dois operadores entram em sala com 1 guichê**
  - *Implementado:* `handlers.js` impede que o segundo operador chame senhas no guichê de outro operador. `QueueManagementScreen.jsx` valida se o operador possui guichê próprio atribuído antes de permitir `callNext`, `callSpecific` e `handleRecall`, evitando conflito de atendimento. ✅

- [ ] **Poder criar times dentro da organização, conseguindo configurar e deixar times para certos guichês ou filas**
  - *Status:* Proposta de funcionalidade futura de maior porte (grupos/times dedicados por fila ou prioridade).

- [x] **Deixar visível no menu de atendimento quantos operadores/admins tem em uma sala e menu com guichês**
  - *Implementado:* Badge no cabeçalho de `QueueManagementScreen.jsx` exibindo contador em tempo real (`👥 X operadores`). Ao clicar, abre modal com a lista de quem está online e qual guichê cada um está operando. ✅

- [x] **Dashboard mantém os mesmos dados das salas, dias nos históricos e logs, mesmo trocando de dispositivo**
  - *Implementado:* Histórico, tickets e logs de auditoria de sessões encerradas persistidos permanentemente na tabela `room_sessions` do PostgreSQL. Consultas via API REST unificada. ✅

- [x] **Permissões no menu de membros da equipe (administrador altera cargos, trava do último admin)**
  - *Implementado:* Somente administradores podem alterar cargos na interface. Administradores podem alterar seus próprios cargos se houver outros administradores na equipe. Se for o único administrador, a alteração é bloqueada no frontend e no backend (`orgService.js`). ✅

---

## Melhorias Adicionais Realizadas

- [x] **Correção do falso positivo do banner de modo offline no Render:** `OfflineBanner.jsx` agora verifica a conectividade real da rede (`!navigator.onLine`), evitando exibir a mensagem quando o sistema estiver hospedado e funcionando normalmente na nuvem. ✅
