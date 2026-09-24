import type { BookingErrorCode, BusyRange, TableName, Tables } from "@/lib/types";

export interface Query<T> {
  eq?: Partial<T>;
  /** Filtros de intervalo em colunas de data/hora (strings ISO). */
  gte?: Partial<Record<keyof T, string>>;
  lt?: Partial<Record<keyof T, string>>;
  order?: Array<[keyof T & string, "asc" | "desc"]>;
  limit?: number;
}

export interface BookingInput {
  serviceId: string;
  startsAtISO: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export class DbError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DbError";
  }
}

export type PrimaryKey = string | number;

/**
 * Camada de dados mínima. Duas implementações: Supabase (produção) e arquivo
 * local (desenvolvimento sem Supabase). Regras de negócio ficam acima daqui.
 */
export interface Db {
  list<K extends TableName>(table: K, query?: Query<Tables[K]>): Promise<Tables[K][]>;
  get<K extends TableName>(table: K, pk: PrimaryKey): Promise<Tables[K] | null>;
  insert<K extends TableName>(table: K, row: Partial<Tables[K]>): Promise<Tables[K]>;
  update<K extends TableName>(table: K, pk: PrimaryKey, patch: Partial<Tables[K]>): Promise<Tables[K]>;
  upsert<K extends TableName>(table: K, row: Partial<Tables[K]>): Promise<Tables[K]>;
  remove(table: TableName, pk: PrimaryKey): Promise<void>;
  /** Intervalos ocupados (agendamentos não cancelados + bloqueios) que tocam [fromISO, toISO). */
  busy(fromISO: string, toISO: string): Promise<BusyRange[]>;
  /** Caminho de escrita do público. Lança DbError com `code: BookingErrorCode`. */
  createBooking(input: BookingInput): Promise<string>;
  uploadMedia(file: File, folder: string): Promise<string>;
}

export const PK_COLUMN: Record<TableName, string> = {
  settings: "id",
  availability: "weekday",
  services: "id",
  clients: "id",
  appointments: "id",
  blocked_slots: "id",
  gallery: "id",
  faq: "id",
  site_content: "key",
};

export function bookingErrorFrom(message: string, code?: string): BookingErrorCode {
  if (code === "23P01") return "conflict";
  const known: BookingErrorCode[] = [
    "service_not_found",
    "invalid_name",
    "invalid_phone",
    "too_soon",
    "too_far",
    "outside_hours",
    "blocked",
  ];
  return known.find((k) => message.includes(k)) ?? "unknown";
}
