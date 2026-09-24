@AGENTS.md

# Jennifer Camila — guia do projeto

Site + agendamento + painel para Jennifer Camila, estética facial e corporal. Next 16, Tailwind v4, Supabase, Vercel. Um profissional por deploy (sem multi-tenancy).

- **Design:** a fonte de verdade é `DESIGN-DIRECTION.md` (conceito "A leitura", paleta "Pele e bisturi", Newsreader + Hanken Grotesk). Tokens em `src/app/globals.css`. Não introduzir cards, pills, gradientes, eyebrows em caixa-alta, `→` em CTA, numeração fora de sequências reais.
- **Conteúdo:** nunca inventar formação, números, preços ou fotos. Tudo que falta é placeholder `[entre colchetes]`, editável no painel. Fotos são slots (`src/lib/content.ts` → `IMAGE_SLOTS`) renderizados por `ImageFrame`.
- **Dados:** tudo passa por `Db` (`src/lib/data/db.ts`). Duas implementações: Supabase e arquivo local (`.data/db.json`, só dev). Regras de horário vivem em `src/lib/scheduling.ts` e espelham a função SQL `create_booking`; ao mudar uma, mude a outra.
- **Painel:** ações em `actions.ts` por rota, sempre via `guarded()` (`src/lib/admin-util.ts`).
- **Fuso:** offset fixo -03:00 (`src/lib/date.ts`).
- **Testes manuais de QA** usam Playwright (a partir de `~/claude-env`); o modo local permite testar o fluxo completo sem Supabase. Ainda **não testado contra um Supabase real** (restrição EXCLUDE, RLS, upload em Storage): validar após configurar o projeto.
