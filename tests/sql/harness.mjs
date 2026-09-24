import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const ROOT = join(import.meta.dirname, "..", "..");

/** Banco novo em memória com shim + todas as migrações (+ seed opcional). */
export async function freshDb({ seed = false } = {}) {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(ROOT, "supabase/local/shim.sql"), "utf8"));
  // O Supabase concede tudo a anon/authenticated por padrão em objetos NOVOS do schema public;
  // é a RLS (e os REVOKE das migrações) que restringem. Reproduzimos isso antes de migrar.
  await db.exec(`
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
  `);
  const dir = join(ROOT, "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  if (seed) await db.exec(readFileSync(join(ROOT, "supabase/seed.sql"), "utf8"));
  return db;
}

/** Executa como um papel do Supabase (anon/authenticated) com o usuário do JWT. */
export async function as(db, role, userId, fn) {
  await db.exec(`set role ${role}`);
  if (userId) await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
