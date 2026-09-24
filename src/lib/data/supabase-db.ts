import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusyRange, TableName, Tables } from "@/lib/types";
import { bookingErrorFrom, DbError, PK_COLUMN, type BookingInput, type Db, type PrimaryKey, type Query } from "@/lib/data/db";

function fail(error: { message: string; code?: string }): never {
  throw new DbError(error.code ?? "unknown", error.message);
}

const pkColumn = (table: TableName): string => PK_COLUMN[table];

export function createSupabaseDb(client: SupabaseClient): Db {
  return {
    async list<K extends TableName>(table: K, query: Query<Tables[K]> = {}) {
      // O builder do supabase-js é encadeado dinamicamente; tipagem solta só aqui.
      let q = client.from(table as string).select("*");
      for (const [col, val] of Object.entries(query.eq ?? {})) q = q.eq(col, val as never);
      for (const [col, val] of Object.entries(query.gte ?? {})) q = q.gte(col, val as never);
      for (const [col, val] of Object.entries(query.lt ?? {})) q = q.lt(col, val as never);
      for (const [col, dir] of query.order ?? []) q = q.order(col, { ascending: dir === "asc" });
      if (query.limit) q = q.limit(query.limit);
      const { data, error } = await q;
      if (error) fail(error);
      return (data ?? []) as Tables[K][];
    },

    async get<K extends TableName>(table: K, pk: PrimaryKey) {
      const { data, error } = await client.from(table as string).select("*").eq(pkColumn(table), pk).maybeSingle();
      if (error) fail(error);
      return (data as Tables[K] | null) ?? null;
    },

    async insert<K extends TableName>(table: K, row: Partial<Tables[K]>) {
      const { data, error } = await client.from(table as string).insert(row as never).select("*").single();
      if (error) fail(error);
      return data as Tables[K];
    },

    async update<K extends TableName>(table: K, pk: PrimaryKey, patch: Partial<Tables[K]>) {
      const { data, error } = await client.from(table as string).update(patch as never).eq(pkColumn(table), pk).select("*").single();
      if (error) fail(error);
      return data as Tables[K];
    },

    async upsert<K extends TableName>(table: K, row: Partial<Tables[K]>) {
      const { data, error } = await client.from(table as string).upsert(row as never, { onConflict: pkColumn(table) }).select("*").single();
      if (error) fail(error);
      return data as Tables[K];
    },

    async remove(table, pk) {
      const { error } = await client.from(table as string).delete().eq(pkColumn(table), pk);
      if (error) fail(error);
    },

    async busy(fromISO, toISO): Promise<BusyRange[]> {
      const { data, error } = await client.from("busy_slots").select("starts_at, ends_at").lt("starts_at", toISO).gt("ends_at", fromISO);
      if (error) fail(error);
      return (data ?? []) as BusyRange[];
    },

    async createBooking(input: BookingInput) {
      const { data, error } = await client.rpc("create_booking", {
        p_service_id: input.serviceId,
        p_starts_at: input.startsAtISO,
        p_name: input.name,
        p_phone: input.phone,
        p_email: input.email ?? null,
        p_notes: input.notes ?? null,
        p_kind: input.kind ?? "service",
      });
      if (error) throw new DbError(bookingErrorFrom(error.message, error.code), error.message);
      return data as string;
    },

    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      const { data, error } = await client.rpc(fn, args);
      // RAISE do banco chega como P0001 com o código na mensagem (ex.: plan_exists).
      if (error) throw new DbError(error.code === "P0001" ? error.message : (error.code ?? "unknown"), error.message);
      return data as T;
    },

    async uploadMedia(file, folder) {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await client.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new DbError("upload_failed", error.message);
      return client.storage.from("media").getPublicUrl(path).data.publicUrl;
    },
  };
}
