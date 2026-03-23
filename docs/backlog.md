# Backlog Tecnico

Estado atual:

- base Expo criada e publicada no GitHub;
- schema e seed iniciais aplicados no Supabase;
- auth por email e senha funcionando;
- bootstrap de `profiles` e `account_memberships` validado por smoke test;
- experimento inicial de RLS investigado, com rollback temporario para manter o app estavel.

## Milestones

### M1 - Fundacao e Auth

- schema inicial, seed e tipos de dominio;
- cliente Supabase e bootstrap do app;
- login, cadastro e sessao;
- sync automatico de `public.profiles`.

Status: concluido

### M2 - Conta esportiva e jogadores

- CRUD de modalidades e conta esportiva;
- grupos prioritarios;
- memberships por conta;
- preferencias de posicao do jogador;
- visualizacao inicial de elenco e conta.

Status: proximo incremento recomendado

### M3 - Eventos e confirmacao

- geracao semanal de eventos;
- edicao da lista de participantes;
- confirmacao de presenca;
- fila por prioridade e corte por limite.

Status: pendente

### M4 - Enquetes e estatisticas

- templates de enquete por conta;
- enquetes concretas por evento;
- votos de jogadores;
- lancamento de estatisticas por participante.

Status: pendente

### M5 - Notificacoes e permissoes

- notificacoes automaticas;
- retomada do RLS em rollout controlado;
- regras por papel;
- endurecimento de acesso para producao.

Status: pendente

## Issues Recomendadas

1. CRUD de modalidades e conta esportiva
2. Cadastro e preferencia de posicoes do jogador
3. Geracao semanal de eventos
4. Confirmacao de presenca com fila por prioridade
5. Enquetes por evento
6. Estatisticas por participante
7. Notificacoes automaticas
8. RLS e permissoes por papel
