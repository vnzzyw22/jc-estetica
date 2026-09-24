import type { Db } from "@/lib/data/db";
import { createFallbackDb } from "@/lib/data/fallback-db";
import { createPgliteDb } from "@/lib/data/pglite-db";
import { createSupabaseDb } from "@/lib/data/supabase-db";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAnonClient } from "@/lib/supabase/anon";
import { createSessionClient } from "@/lib/supabase/server";

let localDb: Db | null = null;
let anonDb: Db | null = null;

// Sem Supabase: em desenvolvimento, Postgres local (PGlite) com as mesmas migrações; em produção,
// só o fallback somente-leitura do conteúdo público (o site não quebra, mas nada é gravado).
const local = () => (localDb ??= process.env.NODE_ENV === "production" ? createFallbackDb() : createPgliteDb());

/** Leituras/escrita públicas (RLS anônima). Sem cookies → páginas cacheáveis. */
export function getPublicDb(): Db {
  if (!isSupabaseConfigured) return local();
  return (anonDb ??= createSupabaseDb(getAnonClient()));
}

/** Operações do painel: com a sessão do admin (RLS `is_admin()`). */
export async function getAdminDb(): Promise<Db> {
  if (!isSupabaseConfigured) return local();
  return createSupabaseDb(await createSessionClient());
}
