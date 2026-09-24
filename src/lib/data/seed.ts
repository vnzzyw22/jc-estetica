import type { AvailabilityRow, ContentRow, FaqItem, Service, ServiceCategory, Settings, Tables } from "@/lib/types";

// Espelha supabase/seed.sql. Tudo entre colchetes é placeholder a ser trocado pelo painel.

export type Store = { [K in keyof Tables]: Tables[K][] };

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

const settings: Settings = {
  id: SETTINGS_ID,
  business_name: "Jennifer Camila",
  business_tagline: "Estética facial e corporal",
  whatsapp: null,
  instagram: null,
  email: null,
  address: null,
  city: null,
  slot_interval_minutes: 30,
  min_notice_hours: 2,
  max_days_ahead: 60,
  buffer_minutes: 0,
  auto_confirm: false,
  timezone: "America/Sao_Paulo",
};

const weekday = (weekdayIdx: number, open: string | null, close: string | null, brk?: [string, string]): AvailabilityRow => ({
  weekday: weekdayIdx,
  is_open: open !== null,
  open_time: open,
  close_time: close,
  break_start: brk?.[0] ?? null,
  break_end: brk?.[1] ?? null,
});

const availability: AvailabilityRow[] = [
  weekday(0, null, null),
  weekday(1, "09:00", "18:00", ["12:00", "13:00"]),
  weekday(2, "09:00", "18:00", ["12:00", "13:00"]),
  weekday(3, "09:00", "18:00", ["12:00", "13:00"]),
  weekday(4, "09:00", "18:00", ["12:00", "13:00"]),
  weekday(5, "09:00", "18:00", ["12:00", "13:00"]),
  weekday(6, "09:00", "13:00"),
];

const service = (n: number, slug: string, name: string, category: ServiceCategory, duration: number, description: string): Service => ({
  id: `00000000-0000-0000-0000-0000000001${String(n).padStart(2, "0")}`,
  slug,
  name,
  category,
  description,
  indication: "[Indicação real]",
  duration_minutes: duration,
  price: null,
  image_url: null,
  active: true,
  display_order: n,
});

const services: Service[] = [
  service(1, "procedimento-facial-1", "[Procedimento facial 1]", "facial", 60, "[Descrição real do procedimento]"),
  service(2, "procedimento-facial-2", "[Procedimento facial 2]", "facial", 90, "[Descrição real do procedimento]"),
  service(3, "procedimento-facial-3", "[Procedimento facial 3]", "facial", 45, "[Descrição real do procedimento]"),
  service(4, "procedimento-corporal-1", "[Procedimento corporal 1]", "corporal", 60, "[Descrição real do procedimento]"),
  service(5, "procedimento-corporal-2", "[Procedimento corporal 2]", "corporal", 75, "[Descrição real do procedimento]"),
  service(6, "protocolo-1", "[Protocolo 1]", "protocolos", 120, "[Descrição real do protocolo]"),
];

const content: ContentRow[] = [
  ["hero.tagline", "Cuidado com precisão, feito por gente."],
  [
    "philosophy.text",
    "Antes de qualquer procedimento, uma conversa e uma leitura atenta da pele e do corpo. O plano é definido com você, no seu ritmo.",
  ],
  ["about.role", "[Formação e especialização da Jennifer — informar]"],
  ["about.text", "[Trajetória real da Jennifer — a ser informada]"],
  ["about.approach", "[Abordagem de atendimento — a ser informada]"],
  ["about.experience", "[Experiência profissional — a ser informada]"],
  ["space.text", "[Descrição real do espaço de atendimento]"],
].map(([key, value]) => ({ key, value }));

const faq: FaqItem[] = (
  [
    ["Como agendo um horário?", "Pelo site, em quatro passos: escolha o procedimento, a data e o horário, informe seus dados e confirme. A Jennifer confirma o agendamento por WhatsApp."],
    ["Quanto tempo dura cada atendimento?", "A duração aparece em cada procedimento, antes de você escolher o horário."],
    ["Preciso me preparar antes do atendimento?", "[Orientações de preparação — informar]"],
    ["Quais são as formas de pagamento?", "[Formas de pagamento — informar]"],
    ["Posso cancelar ou remarcar?", "[Política de cancelamento e remarcação — informar]"],
    ["Onde fica o atendimento?", "[Endereço e orientações de chegada — informar]"],
    ["Tenho dúvida se um procedimento é indicado para mim.", "Chame no WhatsApp antes de agendar. A indicação depende de uma avaliação individual."],
  ] as const
).map(([question, answer], i) => ({
  id: `00000000-0000-0000-0000-0000000002${String(i).padStart(2, "0")}`,
  question,
  answer,
  display_order: i + 1,
  active: true,
}));

export function buildSeed(): Store {
  return {
    settings: [settings],
    availability,
    services,
    clients: [],
    appointments: [],
    blocked_slots: [],
    gallery: [],
    faq,
    site_content: content,
  };
}
