# Financeiro (Etapa 6): estado

Telas concluídas em 2026-09-26. Este arquivo registra o que falta para colocar no ar.

## Pronto e verificado
- Migração 6 (`supabase/migrations/20260927100000_financeiro.sql`), regras puras, carregadores e ações, com 20 testes de SQL e 25 unitários próprios.
- Telas em `src/app/admin/(painel)/financeiro/`: visão geral, recebimentos (lista e detalhe), despesas (lista e detalhe, categorias, repetir recorrentes), relatórios e `exportar` (CSV; 401 sem login).
- Componentes em `src/components/admin/finance/`.
- Ficha da cliente: aba **Financeiro**, linha "Financeiro" no Resumo e evento "Recebimento" na linha do tempo.
- Detalhe do agendamento: "Registrar pagamento" (formulário já ligado ao atendimento; a URL só leva o id, o resto é relido do banco).
- Menu: item "Financeiro".
- QA em navegador com dados demonstrativos: 23 fluxos passaram (receber, parcelar 1.000 em 3x = 333,33 / 333,33 / 333,34, recebido à vista, recusa sem forma de pagamento, despesa e pagamento, recorrentes sem duplicar, CSV, ficha, atalho do agendamento). Sem rolagem horizontal em 320, 375, 390, 430 e 1280 px.
- `npm run lint`, `npm run typecheck`, `npm test` (50 unitários + 88 SQL) e `npm run build`: passam.

## Falta
1. **Aplicar a migração 6 no Supabase real** (SQL Editor, só ela; `npm run db:bundle` já a inclui no arquivo completo). Sem isso, as telas do financeiro falham em produção porque as funções não existem.
2. **Teste ao vivo no Supabase**, com dados fictícios (nomes "Exemplo", telefone `009…`) e limpeza depois. Nunca rodou contra um Supabase real.
3. **Etapa 5**: a interface de pacotes, tratamentos, sessões e evolução. Sem ela, "Gerar parcelas do tratamento" e o vínculo com tratamento no recebimento só aparecem quando existir um tratamento (hoje, só no demo).
4. **Etapa 7**: o dashboard ainda não mostra o financeiro.

## Decisões mantidas
- Valores em reais, somas em centavos; parser de dinheiro BR (`parseMoney`).
- "Receber" exige forma de pagamento (relatórios por forma dependem dela).
- Recebimento pago não é apagado: desfazer antes. Estorno (`refunded`) fica fora da interface.
- Sem biblioteca de gráfico: barras finas em CSS. Sem cartões de KPI.
- Listas do mês usam a mesma regra do caixa (pago pela data do pagamento; previsto pelo vencimento) e duas consultas limitadas, não a tabela inteira.
