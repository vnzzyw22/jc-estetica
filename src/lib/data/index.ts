import type { Db } from "@/lib/data/db";
import { createLocalDb } from "@/lib/data/local-db";
import { createSupabaseDb } from "@/lib/data/supabase-db";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAnonClient } from "@/lib/supabase/anon";
import { createSessionClient } from "@/lib/supabase/server";

let localDb: Db | null = null;
let anonDb: Db | null = null;

const local = () => (localDb ??= createLocalDb());

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
