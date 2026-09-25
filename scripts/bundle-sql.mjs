// Gera supabase/setup-completo.sql: as migrações (em ordem) + o seed de PRODUÇÃO num arquivo só,
// para colar de uma vez no SQL Editor do Supabase. NÃO inclui dados demonstrativos.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const dir = join(ROOT, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const parts = [
  `-- ============================================================================
-- Jennifer Camila — instalação COMPLETA do banco (Supabase).
-- Gerado por \`npm run db:bundle\` a partir de supabase/migrations + supabase/seed.sql.
-- NÃO edite à mão: edite as migrações e gere de novo.
--
-- Como usar: Supabase → SQL Editor → New query → cole TUDO → Run.
-- Rode UMA vez, num projeto vazio. Não contém dados fictícios nem de clientes.
-- Depois: crie o usuário em Authentication e rode o passo "PÓS-INSTALAÇÃO" abaixo.
-- ============================================================================
`,
  ...files.map((f) => `-- ---------------------------------------------------------------------------\n-- MIGRAÇÃO: ${f}\n-- ---------------------------------------------------------------------------\n${readFileSync(join(dir, f), "utf8")}`),
  `-- ---------------------------------------------------------------------------\n-- SEED DE PRODUÇÃO: supabase/seed.sql\n-- ---------------------------------------------------------------------------\n${readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8")}`,
  `-- ---------------------------------------------------------------------------
-- PÓS-INSTALAÇÃO (rode SEPARADO, depois de criar o usuário em Authentication → Users):
--
--   insert into public.admin_profiles (user_id, display_name)
--   values ('COLE-AQUI-O-UUID-DO-USUARIO', 'Jennifer Camila');
--
-- Sem essa linha o painel recusa o acesso, mesmo com login válido.
-- ---------------------------------------------------------------------------
`,
];

writeFileSync(join(ROOT, "supabase", "setup-completo.sql"), parts.join("\n"), "utf8");
console.log(`supabase/setup-completo.sql gerado (${files.length} migrações + seed).`);
