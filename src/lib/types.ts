export type ServiceCategory = "facial_olhar" | "corporal_modelagem" | "terapias_bem_estar";
export type AppointmentKind = "evaluation" | "return" | "session" | "service" | "other";
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
  evaluation_duration_minutes: number;
  /** Produção: true. Sem termo de consentimento ATIVO a triagem não coleta dados. */
  screening_requires_consent_term: boolean;
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
  /** Duração real confirmada pela Jennifer. Só então o site a exibe. */
  duration_confirmed: boolean;
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
  service_id: string | null;
  professional_id: string;
  screening_id: string | null;
  kind: AppointmentKind;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "site" | "admin";
  notes: string | null;
  created_at: string;
}

export interface BlockedSlot {
  id: string;
  professional_id: string | null;
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

export type ScreeningStatus = "new" | "in_review" | "evaluation_scheduled" | "evaluated" | "treatment_proposed" | "treatment_active" | "closed";
export type ScreeningSource = "instagram" | "site" | "referral" | "whatsapp" | "other";
export type InterestArea = ServiceCategory | "not_sure";
export type TreatmentStatus = "proposed" | "active" | "paused" | "completed" | "cancelled";
export type SessionStatus = "unscheduled" | "scheduled" | "confirmed" | "completed" | "cancelled" | "rescheduled";
export type BillingMode = "package" | "per_session";
export type PaymentKind = "treatment" | "session" | "service" | "other";
export type PaymentMethod = "pix" | "cash" | "debit" | "credit" | "transfer" | "other";
export type PaymentStatus = "pending" | "paid" | "cancelled" | "refunded";

export interface Professional {
  id: string;
  name: string;
  active: boolean;
  is_default: boolean;
}

export interface ConsentTerm {
  id: string;
  kind: "screening" | "anamnesis" | "treatment";
  version: string;
  body: string;
  active: boolean;
  published_at: string | null;
  created_at: string;
}

/** Triagem = lead. Nome, telefone e e-mail vivem só em clients (fonte central). */
export interface Screening {
  id: string;
  client_id: string;
  status: ScreeningStatus;
  source: ScreeningSource;
  source_detail: string | null;
  interest_area: InterestArea | null;
  goal: string | null;
  complaint: string | null;
  desired_outcome: string | null;
  answers: Record<string, unknown>;
  consent_term_id: string | null;
  consented_at: string | null;
  status_changed_at: string;
  internal_notes: string | null;
  created_at: string;
}

export interface Anamnesis {
  id: string;
  client_id: string;
  screening_id: string | null;
  professional_id: string;
  status: "draft" | "completed";
  assessed_at: string | null;
  evaluation: string | null;
  relevant_history: string | null;
  contraindications: string | null;
  additional_info: string | null;
  professional_notes: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface TreatmentPackage {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  session_count: number;
  interval_days: number | null;
  frequency_note: string | null;
  price: number | null;
  validity_days: number | null;
  notes: string | null;
  active: boolean;
  display_order: number;
}

export interface PackageService {
  id: string;
  package_id: string;
  service_id: string;
  position: number;
}

export interface Treatment {
  id: string;
  client_id: string;
  package_id: string | null;
  screening_id: string | null;
  professional_id: string;
  name: string;
  goal: string | null;
  status: TreatmentStatus;
  total_sessions: number;
  interval_days: number | null;
  frequency_note: string | null;
  billing_mode: BillingMode;
  price_total: number | null;
  session_price: number | null;
  valid_until: string | null;
  proposed_at: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface TreatmentSession {
  id: string;
  treatment_id: string;
  number: number;
  service_id: string | null;
  appointment_id: string | null;
  status: SessionStatus;
  performed_at: string | null;
  notes: string | null;
}

export interface Evolution {
  id: string;
  treatment_id: string;
  session_id: string | null;
  recorded_at: string;
  notes: string;
  photos: unknown[];
}

export interface Payment {
  id: string;
  kind: PaymentKind;
  client_id: string | null;
  treatment_id: string | null;
  session_id: string | null;
  appointment_id: string | null;
  description: string | null;
  amount: number;
  method: PaymentMethod | null;
  status: PaymentStatus;
  installment_number: number;
  installment_total: number;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  kind: "fixed" | "variable";
  active: boolean;
}

export interface Expense {
  id: string;
  category_id: string;
  description: string;
  amount: number;
  incurred_on: string;
  paid_at: string | null;
  is_recurring: boolean;
  notes: string | null;
}

/** Views (somente leitura). */
export interface TreatmentProgress {
  treatment_id: string;
  total_sessions: number;
  completed: number;
  scheduled: number;
  unscheduled: number;
}

export interface CashFlowRow {
  direction: "in" | "out";
  occurred_on: string;
  amount: number;
  state: "realized" | "expected";
  source: "payment" | "expense";
  source_id: string;
  client_id: string | null;
  treatment_id: string | null;
  category: string;
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
  professionals: Professional;
  consent_terms: ConsentTerm;
  screenings: Screening;
  anamneses: Anamnesis;
  treatment_packages: TreatmentPackage;
  package_services: PackageService;
  treatments: Treatment;
  treatment_sessions: TreatmentSession;
  evolutions: Evolution;
  payments: Payment;
  expense_categories: ExpenseCategory;
  expenses: Expense;
  treatment_progress: TreatmentProgress;
  cash_flow: CashFlowRow;
}

export type TableName = keyof Tables;

export type BookingErrorCode =
  | "service_not_found"
  | "invalid_name"
  | "invalid_phone"
  | "too_soon"
  | "too_far"
  | "invalid_kind"
  | "outside_hours"
  | "blocked"
  | "conflict"
  | "unknown";
