@AGENTS.md

# Jennifer Camila — guia do projeto

Site + agendamento + painel para Jennifer Camila, estética facial e corporal. Next 16, Tailwind v4, Supabase, Vercel. Um profissional por deploy (sem multi-tenancy).

- **Design:** a fonte de verdade é `DESIGN-DIRECTION.md` (conceito "A leitura", paleta "Pele e bisturi", Newsreader + Hanken Grotesk). Tokens em `src/app/globals.css`. Não introduzir cards, pills, gradientes, eyebrows em caixa-alta, `→` em CTA, numeração fora de sequências reais.
- **Conteúdo:** nunca inventar formação, números, preços ou fotos. Tudo que falta é placeholder `[entre colchetes]`, editável no painel. Fotos são slots (`src/lib/content.ts` → `IMAGE_SLOTS`) renderizados por `ImageFrame`.
- **Dados:** tudo passa por `Db` (`src/lib/data/db.ts`). Implementações: Supabase (produção), PGlite (dev/demo: Postgres real com as mesmas migrações, `.data/pgdata`) e fallback somente-leitura (produção sem Supabase). Regras de negócio atômicas (triagem, tratamento, sessões, pagamentos) vivem em **funções SQL** em `supabase/migrations` e são chamadas via `db.rpc`; testes em `tests/sql` (`npm run test:sql`). Regras de horário livre vivem em `src/lib/scheduling.ts` e espelham `create_booking`; ao mudar uma, mude a outra.
- **Modelo:** `clients` é a fonte central; `appointments` é a única agenda (`kind`: evaluation/return/session/service/other); financeiro é `payments` + `expenses` com a view `cash_flow`. Ver `docs/DADOS-E-AMBIENTE.md`.
- **Dados demonstrativos:** só em `supabase/demo/` (nunca no seed de produção). Nomes fictícios, telefones `009…`.
- **Migrações:** nunca editar uma já aplicada; criar nova. Toda tabela nova com dado pessoal/saúde/financeiro: RLS só `is_admin()` e teste em `tests/sql`.
- **Painel:** ações em `actions.ts` por rota, sempre via `guarded()` (`src/lib/admin-util.ts`).
- **Fuso:** offset fixo -03:00 (`src/lib/date.ts`).
- **QA manual** usa Playwright (a partir de `~/claude-env`). Ainda **não testado contra um Supabase real**: validar com o checklist de `docs/DADOS-E-AMBIENTE.md` após configurar o projeto.
- **Roadmap (aprovado):** dados → serviços reais → triagem → ficha da cliente → tratamentos/pacotes/sessões/evolução → financeiro/relatórios → dashboard → polimento. Etapas 0–1 (dados) concluídas.
