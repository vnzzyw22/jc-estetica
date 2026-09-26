export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Sem Supabase, o app usa o banco em arquivo (só desenvolvimento; ver lib/data/pglite-db.ts). */
export const isLocalMode = !isSupabaseConfigured;
