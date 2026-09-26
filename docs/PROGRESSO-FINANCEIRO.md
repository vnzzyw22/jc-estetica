# Financeiro (6), Tratamentos (5), Dashboard (7) e Polimento: estado

Telas das três etapas concluídas em 2026-09-26. Este arquivo registra o que falta para colocar no ar.

## Pronto e verificado

**Financeiro (Etapa 6)**
- Migração 6, regras puras, carregadores e ações, com testes próprios.
- Telas em `src/app/admin/(painel)/financeiro/`: visão geral, recebimentos (lista e detalhe), despesas (lista e detalhe, categorias, repetir recorrentes), relatórios e `exportar` (CSV; 401 sem login).
- Ficha da cliente: aba **Financeiro**, linha no Resumo e evento "Recebimento" na linha do tempo. Detalhe do agendamento: "Registrar pagamento".

**Tratamentos (Etapa 5)**
- Migração 7 (`cancel_treatment`, `pause_treatment`, `save_package_services`), com 16 testes de SQL (inclui permissões: anônimo barrado, não-admin não enxerga nada).
- `src/lib/treatment.ts` (regras puras, 20 testes unitários), `src/lib/treatment-data.ts` (carregadores).
- Telas: `/admin/pacotes` (catálogo, serviços em ordem), `/admin/tratamentos` (lista com progresso e próxima sessão) e `/admin/tratamentos/[id]` (iniciar, pausar, retomar, cancelar, agendar e remarcar sessões, marcar como realizada com nota, evolução, parcelas, edição). Aba **Tratamentos** na ficha da cliente e sessões realizadas na linha do tempo.

**Dashboard (Etapa 7)**
- `src/lib/dashboard.ts` (fila de atenção e agrupamento por dia, puros, 9 testes), `src/lib/dashboard-data.ts` (carregador: uma consulta de agenda em vez de três).
- Tela: precisa de atenção, números do dia, agenda de hoje, próximos agendamentos, financeiro do mês e tratamentos em andamento. Testada com dados demonstrativos e com o banco vazio ("Tudo em dia").

**Polimento**
- Acessibilidade (axe-core, WCAG 2.2 AA): painel com 0 violações nas 23 telas; site corrigido (contraste das abas inativas e dos passos do agendamento, h1 em /sobre, ordem de títulos em /tratamentos). Resta um falso positivo: o rótulo vertical da régua usa `mix-blend-difference`, que o axe não calcula.
- Migração 8: `create_booking` v3 (3 reservas futuras pelo site por telefone, tamanhos máximos) e `activate_consent_term` (atômico); freio por IP também no agendamento público.
- Paginação em toda listagem do Supabase (`src/lib/paging.ts`): antes, listas passavam de 1000 linhas sem aviso.
- Configurações: duração da avaliação. Ações rápidas de agendamento (confirmar, cancelar, reabrir, excluir) mostram o motivo quando falham. Mensagens específicas nas ações de anamnese e triagem.

**Verificação (2026-09-26)**
- `npm run lint`, `npm run typecheck`, `npm test` (86 unitários + 116 SQL), `npm run build` e `node scripts/verify-bundle.mjs` (anônimo barrado nas funções administrativas, inclusive as três novas): passam.
- Navegador, com dados demonstrativos: 23 fluxos do financeiro e 32 fluxos de tratamentos, todos passando. Sem rolagem horizontal em 320, 375, 390, 430 e 1280 px.

## Falta
1. **Aplicar as migrações 6, 7 e 8 no Supabase real** (SQL Editor, nessa ordem; `npm run db:bundle` já as inclui no arquivo completo). Sem isso, as telas de financeiro e de tratamentos falham em produção porque as funções não existem.
2. **Teste ao vivo no Supabase**, com dados fictícios (nomes "Exemplo", telefone `009…`) e limpeza depois. Nada disso rodou contra um Supabase real. Ponto a observar: chamadas de função com lista de ids (`save_package_services`) passam pelo cliente do Supabase, que só foi exercitado no banco local.
3. Fotos de evolução: a coluna existe, o upload ainda não (deve ir para um bucket **privado**).

## Decisões mantidas
- Valores em reais, somas em centavos; parser de dinheiro BR (`parseMoney`).
- "Receber" exige forma de pagamento. Recebimento pago não é apagado: desfazer antes. Estorno fica fora da interface.
- Cancelar tratamento **não mexe nas cobranças**: o que fazer com o dinheiro é decisão da Jennifer, no Financeiro.
- Sessão realizada não volta atrás. Pacote é copiado para o tratamento: editar o pacote não altera tratamentos existentes.
- Sem biblioteca de gráfico: barras finas em CSS. Sem cartões de KPI.
