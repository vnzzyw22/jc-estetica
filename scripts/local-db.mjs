// Gerencia o banco LOCAL de desenvolvimento (PGlite em .data/pgdata).
//   node scripts/local-db.mjs demo-load   carrega os dados demonstrativos
//   node scripts/local-db.mjs demo-clear  remove só os dados demonstrativos
//   node scripts/local-db.mjs reset       apaga o banco local (volta ao seed de produção)
// PARE o servidor de desenvolvimento antes: o PGlite aceita um processo por vez.
// Este script só toca o banco local; nunca se conecta ao Supabase.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const ROOT = process.cwd();
const DATA = join(ROOT, ".data", "pgdata");
const cmd = process.argv[2];
const read = (f) => readFileSync(join(ROOT, f), "utf8");

if (cmd === "reset") {
  rmSync(join(ROOT, ".data"), { recursive: true, force: true });
  console.log("Banco local apagado. Ele será recriado (migrações + seed de produção) no próximo `npm run dev`.");
  process.exit(0);
}
if (!["demo-load", "demo-clear"].includes(cmd)) {
  console.log("Uso: node scripts/local-db.mjs <demo-load | demo-clear | reset>");
  process.exit(1);
}

// Recusa se o servidor de desenvolvimento estiver usando o banco (dois processos corrompem os dados).
const LOCK = join(ROOT, ".data", "server.lock");
if (existsSync(LOCK)) {
  const pid = Number(readFileSync(LOCK, "utf8").trim());
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch { /* lock velho */ }
  if (alive && pid !== process.pid) {
    console.error(`O servidor de desenvolvimento (processo ${pid}) está usando o banco local. Pare-o (Ctrl+C no \`npm run dev\`) e rode de novo.`);
    process.exit(1);
  }
}

mkdirSync(DATA, { recursive: true });
const db = new PGlite(DATA, { extensions: { btree_gist } });
await db.waitReady;
await db.exec("create table if not exists public._local_migrations (name text primary key, applied_at timestamptz default now())");
const applied = new Set((await db.query("select name from public._local_migrations")).rows.map((r) => r.name));
const mark = (n) => db.query("insert into public._local_migrations (name) values ($1)", [n]);
if (!applied.has("__shim")) { await db.exec(read("supabase/local/shim.sql")); await mark("__shim"); }
for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  if (!applied.has(f)) { await db.exec(read(`supabase/migrations/${f}`)); await mark(f); }
}
if (!applied.has("__seed")) { await db.exec(read("supabase/seed.sql")); await mark("__seed"); }

await db.exec(read(cmd === "demo-load" ? "supabase/demo/seed-demo.sql" : "supabase/demo/clear-demo.sql"));
const n = (await db.query("select count(*)::int n from public.clients where phone like '009%'")).rows[0].n;
console.log(cmd === "demo-load" ? `Dados demonstrativos carregados (${n} clientes fictícias).` : `Dados demonstrativos removidos (restam ${n}).`);
await db.close();
