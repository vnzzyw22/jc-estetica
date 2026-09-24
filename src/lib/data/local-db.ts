import { promises as fs } from "node:fs";
import path from "node:path";
import type { BusyRange, TableName, Tables } from "@/lib/types";
import { DbError, PK_COLUMN, type BookingInput, type Db, type PrimaryKey, type Query } from "@/lib/data/db";
import { buildSeed, type Store } from "@/lib/data/seed";
import { dateISOFromEpoch, hm, timeLabel } from "@/lib/date";
import { digitsOnly } from "@/lib/format";
import { validateSlot } from "@/lib/scheduling";

// Banco em arquivo para desenvolver/QA sem Supabase. Em produção nunca persiste:
// leitura vem do seed em memória e qualquer escrita é recusada.

const isProd = process.env.NODE_ENV === "production";
const FILE = path.join(process.cwd(), ".data", "db.json");

let memory: Store | null = null;

async function load(): Promise<Store> {
  if (memory) return memory;
  if (!isProd) {
    try {
      memory = JSON.parse(await fs.readFile(FILE, "utf8")) as Store;
      return memory;
    } catch {
      /* primeiro uso: cai no seed */
    }
  }
  memory = buildSeed();
  if (!isProd) await save(memory);
  return memory;
}

async function save(store: Store): Promise<void> {
  if (isProd) throw new DbError("not_configured", "Supabase não configurado: escrita indisponível em produção.");
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
}

type AnyRow = Record<string, unknown>;

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a as string | number) < (b as string | number) ? -1 : 1;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime();
}

function assertConstraints(store: Store, table: TableName, row: AnyRow): void {
  if (table === "services" && store.services.some((s) => s.slug === row.slug && s.id !== row.id)) {
    throw new DbError("23505", "slug duplicado");
  }
  if (table === "clients" && store.clients.some((c) => c.phone === row.phone && c.id !== row.id)) {
    throw new DbError("23505", "telefone duplicado");
  }
  if (table === "appointments" && row.status !== "cancelled") {
    const clash = store.appointments.some(
      (a) => a.id !== row.id && a.status !== "cancelled" && overlaps(a.starts_at, a.ends_at, row.starts_at as string, row.ends_at as string),
    );
    if (clash) throw new DbError("23P01", "conflito de horário");
  }
}

function applyDefaults(table: TableName, row: AnyRow): AnyRow {
  const out: AnyRow = { ...row };
  if (PK_COLUMN[table] === "id" && !out.id) out.id = crypto.randomUUID();
  if (!("created_at" in out) && ["clients", "appointments", "blocked_slots"].includes(table)) out.created_at = new Date().toISOString();
  return out;
}

export function createLocalDb(): Db {
  const rowsOf = (store: Store, table: TableName) => store[table] as unknown as AnyRow[];

  return {
    async list<K extends TableName>(table: K, query: Query<Tables[K]> = {}) {
      const store = await load();
      let rows = [...rowsOf(store, table)];
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

    async get<K extends TableName>(table: K, pk: PrimaryKey) {
      const store = await load();
      const found = rowsOf(store, table).find((r) => r[PK_COLUMN[table]] === pk);
      return found ? (structuredClone(found) as unknown as Tables[K]) : null;
    },

    async insert<K extends TableName>(table: K, row: Partial<Tables[K]>) {
      const store = await load();
      const next = applyDefaults(table, row as AnyRow);
      assertConstraints(store, table, next);
      rowsOf(store, table).push(next);
      await save(store);
      return structuredClone(next) as unknown as Tables[K];
    },

    async update<K extends TableName>(table: K, pk: PrimaryKey, patch: Partial<Tables[K]>) {
      const store = await load();
      const rows = rowsOf(store, table);
      const idx = rows.findIndex((r) => r[PK_COLUMN[table]] === pk);
      if (idx < 0) throw new DbError("PGRST116", "registro não encontrado");
      const next = { ...rows[idx], ...(patch as AnyRow) };
      assertConstraints(store, table, next);
      rows[idx] = next;
      await save(store);
      return structuredClone(next) as unknown as Tables[K];
    },

    async upsert<K extends TableName>(table: K, row: Partial<Tables[K]>) {
      const pk = (row as AnyRow)[PK_COLUMN[table]] as PrimaryKey | undefined;
      const existing = pk !== undefined ? await this.get(table, pk) : null;
      return existing ? this.update(table, pk as PrimaryKey, row) : this.insert(table, row);
    },

    async remove(table, pk) {
      const store = await load();
      const rows = rowsOf(store, table);
      const idx = rows.findIndex((r) => r[PK_COLUMN[table]] === pk);
      if (idx < 0) return;
      if (table === "clients" && store.appointments.some((a) => a.client_id === pk)) throw new DbError("23503", "cliente com agendamentos");
      if (table === "services" && store.appointments.some((a) => a.service_id === pk)) throw new DbError("23503", "serviço com agendamentos");
      rows.splice(idx, 1);
      await save(store);
    },

    async busy(fromISO, toISO): Promise<BusyRange[]> {
      const store = await load();
      const ranges: BusyRange[] = [
        ...store.appointments.filter((a) => a.status !== "cancelled"),
        ...store.blocked_slots,
      ].map((r) => ({ starts_at: r.starts_at, ends_at: r.ends_at }));
      return ranges.filter((r) => overlaps(r.starts_at, r.ends_at, fromISO, toISO));
    },

    async createBooking(input: BookingInput) {
      const store = await load();
      const service = store.services.find((s) => s.id === input.serviceId && s.active);
      if (!service) throw new DbError("service_not_found");
      const phone = digitsOnly(input.phone);
      if (input.name.trim().length < 2) throw new DbError("invalid_name");
      if (phone.length < 10 || phone.length > 13) throw new DbError("invalid_phone");

      const startMs = new Date(input.startsAtISO).getTime();
      const dateISO = dateISOFromEpoch(startMs);
      const time = hm(timeLabel(input.startsAtISO));
      const code = validateSlot(dateISO, time, service.duration_minutes, store.blocked_slots, {
        settings: store.settings[0],
        availability: store.availability,
        busy: [],
      });
      if (code) throw new DbError(code);

      const endsAt = new Date(startMs + service.duration_minutes * 60_000).toISOString();
      let client = store.clients.find((c) => c.phone === phone);
      if (client) {
        client.name = input.name.trim();
        client.email = input.email?.trim() || client.email;
      } else {
        client = {
          id: crypto.randomUUID(),
          name: input.name.trim(),
          phone,
          email: input.email?.trim() || null,
          notes: null,
          created_at: new Date().toISOString(),
        };
        store.clients.push(client);
      }

      const row = {
        id: crypto.randomUUID(),
        client_id: client.id,
        service_id: service.id,
        starts_at: new Date(startMs).toISOString(),
        ends_at: endsAt,
        status: store.settings[0].auto_confirm ? ("confirmed" as const) : ("pending" as const),
        source: "site" as const,
        notes: input.notes?.trim() || null,
        created_at: new Date().toISOString(),
      };
      assertConstraints(store, "appointments", row);
      store.appointments.push(row);
      await save(store);
      return row.id;
    },

    async uploadMedia(file, folder) {
      if (isProd) throw new DbError("not_configured", "Upload indisponível sem Supabase.");
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = `${crypto.randomUUID()}.${ext}`;
      const dir = path.join(process.cwd(), "public", "uploads", folder);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      return `/uploads/${folder}/${name}`;
    },
  };
}

