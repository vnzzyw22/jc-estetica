export type ServiceCategory = "facial" | "corporal" | "tratamentos" | "protocolos";
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type BlockKind = "block" | "day_off" | "vacation" | "holiday" | "personal";
export type GalleryCategory = "facial" | "corporal" | "espaco" | "profissional";

export interface Settings {
  id: string;
  business_name: string;
  business_tagline: string;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  slot_interval_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  buffer_minutes: number;
  auto_confirm: boolean;
  timezone: string;
}

export interface AvailabilityRow {
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  category: ServiceCategory;
  description: string | null;
  indication: string | null;
  duration_minutes: number;
  price: number | null;
  image_url: string | null;
  active: boolean;
  display_order: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "site" | "admin";
  notes: string | null;
  created_at: string;
}

export interface BlockedSlot {
  id: string;
  starts_at: string;
  ends_at: string;
  kind: BlockKind;
  reason: string | null;
  created_at: string;
}

export interface GalleryItem {
  id: string;
  image_url: string;
  title: string | null;
  category: GalleryCategory;
  display_order: number;
  featured: boolean;
  active: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  active: boolean;
}

export interface ContentRow {
  key: string;
  value: string;
}

export interface BusyRange {
  starts_at: string;
  ends_at: string;
}

export interface AppointmentDetail extends Appointment {
  client: Client | null;
  service: Service | null;
}

/** Nome de tabela → tipo da linha. */
export interface Tables {
  settings: Settings;
  availability: AvailabilityRow;
  services: Service;
  clients: Client;
  appointments: Appointment;
  blocked_slots: BlockedSlot;
  gallery: GalleryItem;
  faq: FaqItem;
  site_content: ContentRow;
}

export type TableName = keyof Tables;

export type BookingErrorCode =
  | "service_not_found"
  | "invalid_name"
  | "invalid_phone"
  | "too_soon"
  | "too_far"
  | "outside_hours"
  | "blocked"
  | "conflict"
  | "unknown";
