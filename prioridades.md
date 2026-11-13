- Login e criar conta não funcionam sem internet (mesmo sistema de sync quando a internet voltar?);

- Adicionar um tipo de dado **data** como campo personalizado, caso o estabelecimento precise da data de nascimento do usuário;

- Como integrar o programa em dispositivos diferentes (interface mobile);

- Ter uma mensagem de aviso caso o usuário tente sair da fila após ser chamada novamente;

- Dono/owner pode transferir a posse da instituição para outro usuário. Para o caso de algum usuário externo como um TI de um local montar a sala e entregar a posse para o verdadeiro dono do estabelecimento/instituição;

- Alterar o layout para que o layout quando estiver com uma sessão não seja idêntico (tirando o "olá, email) ao layout sem uma sessão/conta;

- Ao chamar a pessoa de volta para a fila, poder alterar a categoria para outra ou colocar automaticamente uma (por exemplo, "Retorno") [OPCIONAL];

**Feedback com prioridades altas e médias aplicadas**

- Verificar se o histórico do dia se mantém. No menu dashboard, ao fechar a sala, funcionou corretamente, porém ao abrir no próximo dia, o dado sumiu. Guarde no banco de dados qualquer registro;

- Separar as salas como "dias" para não ter que personalizar cada um dos dias, as salas serão configuradas (com os campos extras necessários, configurações, nomes de guichês, principalmente para evitar trocar acidentalmente durante um dia). Com isso, ao deixar uma sala salva, abrir o dia fica mais simples e tranquilo, só verifica as informações e configurações usadas antes;

- Na criação da sala, é possível definir que depois de x pessoas na prioridade alta, chama alguém de prioridade média. Porém não aparenta ter isso de x na prioridade média para chamar uma baixa. Essa configuração pode ficar na configuração da sala ao invés do dia/sessão, ainda mais se só tiver 2 prioridades ou mais de 3, pois isso pode mudar bastante (deixe customizável);

- Melhorar o dashboard, colocando filtro [dia, funcionário(s) responsável(is) no dia, número de pessoas atendidas] e organização por data (podendo escolher início e fim de um período ou "todo o tempo"), permita também exportar os dados principalmente em csv, excel e pdf (com os resultados dos filtros ou "tudo"). No menu de "detalhes" em cada um dos dias, colocar as informações de horário de entrada e saída dos clientes para servir de auditoria ao reanalizar os dias, atualmente algumas informações naquele menu estão faltando;

- Incluir log (pelo menos nas salas, sobre a ação dos funcionários como "abriu", "trancou" ou "fechou o dia") e o horário da ação;

- Colocar gráficos no dashboard, se possível;

- Para o menu de convidar membros para a equipe, ficou melhor com um link (como está atualmente, gerando um link de convite). Tire a funcionalidade de colocar o email da pessoa e deixe só um botão para gerar um link. Faça disso um link temporário para entrarem na equipe e faça esse link durar por alguns minutos. Após aceitarem deixe a pessoa em uma "fila" até o dono ou administrador adicionar a pessoa;

- Verifique as permissões e se cada uma está correta com o que pode modificar (autorização). Nos testes foi convidado um membro como operador e ele podia modificar configurações da sala;

- Remover o cargo de dono. O usuário pode ser sem conta (só entra em filas), operador (funcionário do estabelecimento, só pode abrir a fila do dia, utilizar as funcionalidades presentes dentro da fila, trancar a fila e encerrar o dia) e administrador (Faz tudo o que o operador faz mas consegue também mexer nas configurações das salas e modificar os cargos dos outros membros de equipe).