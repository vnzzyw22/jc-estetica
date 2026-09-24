import type { BusyRange, TableName, Tables } from "@/lib/types";
import { DbError, PK_COLUMN, type Db, type PrimaryKey, type Query } from "@/lib/data/db";
import { buildSeed, type Store } from "@/lib/data/seed";

// FALLBACK de produção sem Supabase configurado: serve só o conteúdo PÚBLICO (seed em memória) para
// o site não quebrar. Qualquer escrita, função ou upload é recusada. Não é um modo de operação:
// sem as variáveis do Supabase não há agendamento, triagem nem painel.

let store: Store | null = null;
const data = (): Store => (store ??= buildSeed());

type AnyRow = Record<string, unknown>;

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a as string | number) < (b as string | number) ? -1 : 1;
}

const notConfigured = (): never => {
  throw new DbError("not_configured", "Supabase não configurado: esta operação exige banco de dados.");
};

export function createFallbackDb(): Db {
  const rowsOf = (name: TableName): AnyRow[] => ((data() as unknown as Record<string, unknown[]>)[name] ?? []) as AnyRow[];

  return {
    async list<K extends TableName>(name: K, query: Query<Tables[K]> = {}) {
      let rows = [...rowsOf(name)];
      for (const [col, val] of Object.entries(query.eq ?? {})) rows = rows.filter((r) => r[col] === val);
      for (const [col, val] of Object.entries(query.gte ?? {})) rows = rows.filter((r) => compare(r[col], val) >= 0);
      for (const [col, val] of Object.entries(query.lt ?? {})) rows = rows.filter((r) => compare(r[col], val) < 0);
      const order = query.order ?? [];
      if (order.length) {
        rows.sort((a, b) => {
          for (const [col, dir] of order) {
            const c = compare(a[col], b[col]);
            if (c) return dir === "asc" ? c : -c;
          }
          return 0;
        });
      }
      if (query.limit) rows = rows.slice(0, query.limit);
      return structuredClone(rows) as unknown as Tables[K][];
    },
    async get<K extends TableName>(name: K, pk: PrimaryKey) {
      const found = rowsOf(name).find((r) => r[PK_COLUMN[name]] === pk);
      return found ? (structuredClone(found) as unknown as Tables[K]) : null;
    },
    async insert() {
      return notConfigured();
    },
    async update() {
      return notConfigured();
    },
    async upsert() {
      return notConfigured();
    },
    async remove() {
      return notConfigured();
    },
    async busy(): Promise<BusyRange[]> {
      return [];
    },
    async createBooking() {
      return notConfigured();
    },
    async rpc() {
      return notConfigured();
    },
    async uploadMedia() {
      return notConfigured();
    },
  };
}
