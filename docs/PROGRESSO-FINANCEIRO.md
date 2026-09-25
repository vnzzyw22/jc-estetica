# Financeiro (Etapa 6) — ONDE PARAMOS

Trabalho **pausado no meio** a pedido do usuário. Data: 2026-09-25.

## Pronto e testado
- `supabase/migrations/20260927100000_financeiro.sql` (migração 6):
  - `cash_flow` ganha `description`, `method`, `category_name` (colunas no fim);
  - `create_receivable(...)`: recebimento à vista ou parcelado (avulso, ou ligado a cliente / tratamento / atendimento);
  - `change_payment_status(id, para, data, forma)`: pendente → pago | cancelado; pago/cancelado → pendente;
  - `generate_recurring_expenses(mês)`: repete as despesas recorrentes, idempotente.
- `tests/sql/financeiro.test.mjs`: 20 testes passando (parcelas fecham o centavo, transições, recorrência, RLS/permissões).
- `src/lib/finance.ts` (regras puras) + `tests/unit/finance.test.mjs`: 20 testes passando.
- `src/lib/finance-data.ts`: carregadores do caixa (mês, faixa de meses, atrasados).
- `src/app/admin/(painel)/financeiro/actions.ts`: todas as server actions (recebimentos, parcelas de tratamento, despesas, recorrentes, categorias).
- `src/lib/format.ts` (`formatMoney` e rótulos), `src/lib/types.ts` (`CashFlowRow`), `src/lib/admin-util.ts` (mensagens de erro do financeiro).

## NÃO aplicado em produção
A migração 6 **ainda não foi rodada no Supabase real**. Nenhuma tela usa o código novo, então o deploy atual não muda nada para a Jennifer.
Antes de publicar as telas: gerar o SQL (`npm run db:bundle` já inclui) e aplicar SÓ a migração 6 no SQL Editor.

## Falta fazer (nesta ordem)
1. **Componentes** em `src/components/admin/finance/`: `finance-nav` (abas Visão geral · Recebimentos · Despesas · Relatórios), `month-switch`, `notice` (lê `?erro=` e `?aviso=`), chips de estado, `payment-row`, `new-receivable-form`, `expense-row`, `expense-form`, extrato por dia, barras da série mensal.
2. **Páginas** em `src/app/admin/(painel)/financeiro/`:
   - `layout.tsx` (título + abas) e `page.tsx` (visão geral do mês: resultado, previsto, atrasados, extrato);
   - `recebimentos/page.tsx` + `[id]/page.tsx` (filtros Todos/A receber/Recebidos/Atrasados/Cancelados; "Receber" abre o formulário pela URL `?receber=id`; parcelas irmãs; cobrança por WhatsApp);
   - `despesas/page.tsx` + `[id]/page.tsx` ("Pagar" por `?pagar=id`, repetir recorrentes, categorias);
   - `relatorios/page.tsx` (resultado do mês, série de 6 meses, receita por forma e por tipo, despesas por categoria e fixas × variáveis, pendências, atividade: tratamentos vendidos/ativos, sessões, clientes novas, origem das triagens);
   - `exportar/route.ts` (CSV do mês; checar admin, responder 401).
3. **Ficha da cliente:** aba **Financeiro** (resumo recebido / a receber / atrasado, gerar parcelas do tratamento, lista, novo recebimento com tratamento e atendimento opcionais), evento "Recebimento" na linha do tempo (`client-file.ts` carrega `payments`), linha "Financeiro" no Resumo.
4. **Ligação com a agenda:** botão "Registrar pagamento" no detalhe do agendamento (pré-preenche cliente, serviço e valor).
5. **Menu:** item "Financeiro" em `admin-nav.tsx`.
6. **Fechamento:** adicionar `financeiro.test.mjs` já está no `package.json`; rodar `npm test`; QA visual (desktop e mobile) com dados demo; `docs/DADOS-E-AMBIENTE.md`, `README.md`, `CLAUDE.md`; aplicar a migração 6 em produção; teste ao vivo com dados fictícios e limpar.

## Decisões já tomadas
- Valores em reais, somas em centavos; parser de dinheiro BR (`parseMoney`).
- "Receber" exige forma de pagamento (relatórios por forma dependem disso).
- Recebimento pago não é apagado: desfazer antes. Estorno (`refunded`) fica fora da interface por enquanto.
- Sem gráfico com biblioteca: barras finas em CSS. Nada de cartões de KPI; a visão geral é um número grande + extrato por dia.
- Nada disso muda o dashboard atual (o novo dashboard é a Etapa 7).
