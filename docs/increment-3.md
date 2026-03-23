# Incremento 3

## Escopo
- trocar a aba `Inicio` para ler configuracao real da conta esportiva no Supabase
- trocar a aba `Elenco` para listar memberships reais
- permitir que o proprio jogador atualize nome e posicoes favoritas da sua membership
- manter a aba `Agenda` ainda em mock, reservada para o M3 de eventos

## O que foi implementado
- camada `src/lib/accounts.ts` com consultas de conta, horarios, grupos prioritarios, elenco e posicoes
- home com selecao da conta ativa, resumo da configuracao e edicao basica para `group_admin` ou `super_admin`
- elenco com leitura de perfis e preferencias de posicao
- formulario para atualizar `profiles.full_name` e `membership_position_preferences`

## Como testar
1. Entrar com um usuario autenticado no app.
2. Garantir que esse usuario tenha um registro em `account_memberships`.
3. Abrir a aba `Inicio` e conferir:
   - modalidade
   - limite por evento
   - horario semanal
   - grupos prioritarios
4. Se o papel for `group_admin`, editar nome da conta e janelas de confirmacao.
5. Abrir a aba `Elenco` e:
   - conferir o roster real
   - editar o proprio nome
   - adicionar ou remover posicoes favoritas
6. Recarregar o app e validar persistencia.

## Validacao executada
- `npx tsc --noEmit`
- `npx expo export --platform web`

## Pendencias para o proximo corte
- CRUD global de modalidades para `super_admin`
- fluxo de criacao e gestao de memberships pelo app
- migracao da aba `Agenda` para eventos reais
