import { promises as fs, unlinkSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { BusyRange, TableName, Tables } from "@/lib/types";
import { bookingErrorFrom, DbError, PK_COLUMN, type BookingInput, type Db, type PrimaryKey, type Query } from "@/lib/data/db";

// Banco LOCAL de desenvolvimento/demonstração: Postgres real (PGlite, WASM) rodando as MESMAS
// migrações do Supabase. Assim as regras (conflito, triagem, sessões, financeiro) vivem em SQL,
// num só lugar, e o modo local não diverge da produção.
// Sem RLS aqui: a conexão é de superusuário; a autorização do painel é feita por cookie (local-auth).
// Nunca é usado em produção (ver data/index.ts).

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".data", "pgdata");
const LOCK_FILE = path.join(ROOT, ".data", "server.lock");
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

type G = typeof globalThis & { __jcPglite?: Promise<PGlite> };

function toIso(v: string): string {
  // "2026-09-25 13:00:00+00" → ISO 8601 (PostgREST devolve ISO; o app espera ISO).
  const s = v.replace(" ", "T");
  const fixed = /[+-]\d{2}$/.test(s) ? `${s}:00` : s;
  const d = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(fixed) ? fixed : `${fixed}Z`);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

async function applySql(db: PGlite, file: string): Promise<void> {
  await db.exec(await fs.readFile(path.join(ROOT, file), "utf8"));
}

async function migrate(db: PGlite): Promise<void> {
  await db.exec("create table if not exists public._local_migrations (name text primary key, applied_at timestamptz default now())");
  const applied = new Set((await db.query<{ name: string }>("select name from public._local_migrations")).rows.map((r) => r.name));

  if (!applied.has("__shim")) {
    await applySql(db, "supabase/local/shim.sql");
    await db.query("insert into public._local_migrations (name) values ('__shim')");
  }
  const dir = path.join(ROOT, "supabase", "migrations");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    await applySql(db, path.join("supabase", "migrations", f));
    await db.query("insert into public._local_migrations (name) values ($1)", [f]);
  }
  if (!applied.has("__seed")) {
    await applySql(db, "supabase/seed.sql");
    await db.query("insert into public._local_migrations (name) values ('__seed')");
  }
  // Só aqui (banco local, nunca produção): permite testar a triagem sem termo oficial publicado.
  // Bancos reais mantêm o padrão do schema (trava LIGADA).
  if (!applied.has("__dev_relax_consent")) {
    await db.exec("update public.settings set screening_requires_consent_term = false");
    await db.query("insert into public._local_migrations (name) values ('__dev_relax_consent')");
  }
}

/** O PGlite aceita UM processo por diretório. O lock evita que scripts e servidor se atropelem. */
async function acquireLock(): Promise<void> {
  try {
    const pid = Number((await fs.readFile(LOCK_FILE, "utf8")).trim());
    if (pid && pid !== process.pid) {
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch {
        alive = false; // lock velho de um processo que já morreu
      }
      if (alive) throw new DbError("db_locked", `O banco local já está em uso pelo processo ${pid}. Pare o outro servidor.`);
    }
  } catch (err) {
    if (err instanceof DbError) throw err;
  }
  await fs.writeFile(LOCK_FILE, String(process.pid));
  process.once("exit", () => {
    try {
      unlinkSync(LOCK_FILE);
    } catch {
      /* já removido */
    }
  });
}

async function open(): Promise<PGlite> {
  await fs.mkdir(path.dirname(LOCK_FILE), { recursive: true });
  await acquireLock();
  const { PGlite, types } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = new PGlite(DATA_DIR, {
    extensions: { btree_gist },
    parsers: {
      [types.TIMESTAMPTZ]: toIso,
      [types.TIMESTAMP]: toIso,
      [types.DATE]: (v: string) => v,
      [types.NUMERIC]: (v: string) => Number(v),
      [types.INT8]: (v: string) => Number(v),
    },
  });
  await db.waitReady;
  await migrate(db);
  return db;
}

const client = (): Promise<PGlite> => ((globalThis as G).__jcPglite ??= open());

function table(name: string): string {
  if (!(name in PK_COLUMN) || !SAFE_IDENT.test(name)) throw new DbError("invalid_table", `Tabela inválida: ${name}`);
  return `public."${name}"`;
}

function column(name: string): string {
  if (!SAFE_IDENT.test(name)) throw new DbError("invalid_column", `Coluna inválida: ${name}`);
  return `"${name}"`;
}

/** Objetos JS viram JSON para colunas jsonb; o resto passa direto. */
const param = (v: unknown): unknown => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);

/** Erros de RAISE (P0001) carregam o código na mensagem; os demais, o SQLSTATE. */
function wrap(err: unknown): never {
  const e = err as { code?: string; message?: string };
  const code = e.code === "P0001" ? (e.message ?? "unknown") : (e.code ?? "unknown");
  throw new DbError(code, e.message);
}

async function run<T>(fn: (db: PGlite) => Promise<T>): Promise<T> {
  try {
    return await fn(await client());
  } catch (err) {
    if (err instanceof DbError) throw err;
    return wrap(err);
  }
}

export function createPgliteDb(): Db {
  return {
    async list<K extends TableName>(name: K, query: Query<Tables[K]> = {}) {
      const values: unknown[] = [];
      const where: string[] = [];
      for (const [col, val] of Object.entries(query.eq ?? {})) {
        if (val === null) where.push(`${column(col)} is null`);
        else where.push(`${column(col)} = $${values.push(param(val))}`);
      }
      for (const [col, val] of Object.entries(query.gte ?? {})) where.push(`${column(col)} >= $${values.push(val)}`);
      for (const [col, val] of Object.entries(query.lt ?? {})) where.push(`${column(col)} < $${values.push(val)}`);
      const order = (query.order ?? []).map(([col, dir]) => `${column(col)} ${dir === "asc" ? "asc" : "desc"}`);
      const sql = `select * from ${table(name)}${where.length ? ` where ${where.join(" and ")}` : ""}${order.length ? ` order by ${order.join(", ")}` : ""}${query.limit ? ` limit ${Math.floor(query.limit)}` : ""}`;
      return run(async (db) => (await db.query(sql, values)).rows as Tables[K][]);
    },

    async get<K extends TableName>(name: K, pk: PrimaryKey) {
      return run(async (db) => {
        const r = await db.query(`select * from ${table(name)} where ${column(PK_COLUMN[name])} = $1 limit 1`, [pk]);
        return (r.rows[0] as Tables[K] | undefined) ?? null;
      });
    },

    async insert<K extends TableName>(name: K, row: Partial<Tables[K]>) {
      const entries = Object.entries(row).filter(([, v]) => v !== undefined);
      const sql = entries.length
        ? `insert into ${table(name)} (${entries.map(([c]) => column(c)).join(", ")}) values (${entries.map((_, i) => `$${i + 1}`).join(", ")}) returning *`
        : `insert into ${table(name)} default values returning *`;
      return run(async (db) => (await db.query(sql, entries.map(([, v]) => param(v)))).rows[0] as Tables[K]);
    },

    async update<K extends TableName>(name: K, pk: PrimaryKey, patch: Partial<Tables[K]>) {
      const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
      return run(async (db) => {
        if (!entries.length) {
          const r = await db.query(`select * from ${table(name)} where ${column(PK_COLUMN[name])} = $1`, [pk]);
          if (!r.rows[0]) throw new DbError("PGRST116", "registro não encontrado");
          return r.rows[0] as Tables[K];
        }
        const sets = entries.map(([c], i) => `${column(c)} = $${i + 1}`).join(", ");
        const r = await db.query(`update ${table(name)} set ${sets} where ${column(PK_COLUMN[name])} = $${entries.length + 1} returning *`, [...entries.map(([, v]) => param(v)), pk]);
        if (!r.rows[0]) throw new DbError("PGRST116", "registro não encontrado");
        return r.rows[0] as Tables[K];
      });
    },

    async upsert<K extends TableName>(name: K, row: Partial<Tables[K]>) {
      const entries = Object.entries(row).filter(([, v]) => v !== undefined);
      const pkCol = PK_COLUMN[name];
      const updates = entries.filter(([c]) => c !== pkCol).map(([c]) => `${column(c)} = excluded.${column(c)}`);
      const sql = `insert into ${table(name)} (${entries.map(([c]) => column(c)).join(", ")}) values (${entries.map((_, i) => `$${i + 1}`).join(", ")}) on conflict (${column(pkCol)}) ${updates.length ? `do update set ${updates.join(", ")}` : "do nothing"} returning *`;
      return run(async (db) => (await db.query(sql, entries.map(([, v]) => param(v)))).rows[0] as Tables[K]);
    },

    async remove(name, pk) {
      await run((db) => db.query(`delete from ${table(name)} where ${column(PK_COLUMN[name])} = $1`, [pk]));
    },

    async busy(fromISO, toISO): Promise<BusyRange[]> {
      return run(async (db) => (await db.query("select starts_at, ends_at from public.busy_slots where starts_at < $2::timestamptz and ends_at > $1::timestamptz", [fromISO, toISO])).rows as BusyRange[]);
    },

    async createBooking(input: BookingInput) {
      try {
        const db = await client();
        const r = await db.query<{ id: string }>("select public.create_booking($1::uuid, $2::timestamptz, $3, $4, $5, $6, $7) as id", [
          input.serviceId,
          input.startsAtISO,
          input.name,
          input.phone,
          input.email ?? null,
          input.notes ?? null,
          input.kind ?? "service",
        ]);
        return r.rows[0].id;
      } catch (err) {
        const e = err as { code?: string; message?: string };
        throw new DbError(bookingErrorFrom(e.message ?? "", e.code), e.message);
      }
    },

    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      if (!SAFE_IDENT.test(fn)) throw new DbError("invalid_function", `Função inválida: ${fn}`);
      const names = Object.keys(args);
      const call = names.map((n, i) => `${column(n)} := $${i + 1}`).join(", ");
      return run(async (db) => (await db.query<{ result: unknown }>(`select public.${fn}(${call}) as result`, names.map((n) => param(args[n])))).rows[0]?.result as T);
    },

    async uploadMedia(file, folder) {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = `${crypto.randomUUID()}.${ext}`;
      const dir = path.join(ROOT, "public", "uploads", folder);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      return `/uploads/${folder}/${name}`;
    },
  };
}
