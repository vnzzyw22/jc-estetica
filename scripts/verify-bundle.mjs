// Executa o arquivo EXATO supabase/setup-completo.sql num Postgres de teste e confere as garantias de segurança.
// Uso: npm run db:bundle && node scripts/verify-bundle.mjs
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
const R = process.cwd() + "/";
const db = new PGlite({ extensions: { btree_gist } });
await db.exec(readFileSync(R + "supabase/local/shim.sql", "utf8"));
await db.exec("alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on functions to anon, authenticated;");
await db.exec(readFileSync(R + "supabase/setup-completo.sql", "utf8"));   // o arquivo EXATO que vai para o Supabase
const q = async (s) => (await db.query(s)).rows;
console.log("serviços:", (await q("select count(*)::int n from services"))[0].n, "| clientes:", (await q("select count(*)::int n from clients"))[0].n, "| profissionais:", (await q("select count(*)::int n from professionals"))[0].n);
console.log("RLS desligada em alguma tabela?", (await q("select tablename from pg_tables where schemaname='public' and not rowsecurity")).map(r=>r.tablename).join(",") || "nenhuma");
console.log("trava do termo (produção):", (await q("select screening_requires_consent_term v from settings"))[0].v);
console.log("dados fictícios no bundle?", (await q("select count(*)::int n from clients where phone like '009%'"))[0].n);
await db.exec("set role anon");
const anonFn = async (f) => { try { await db.query(`select public.${f}`); return "EXECUTA"; } catch (e) { return e.code === "42501" ? "negado" : "outro:" + e.message; } };
console.log("anon → activate_treatment:", await anonFn("activate_treatment('00000000-0000-0000-0000-000000000000')"));
console.log("anon → schedule_session:", await anonFn("schedule_session('00000000-0000-0000-0000-000000000000', now())"));
console.log("anon lê screenings:", (await q("select count(*)::int n from screenings"))[0].n, "linhas");
await db.exec("reset role");
