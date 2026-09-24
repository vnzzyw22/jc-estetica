"use server";

import { revalidatePath } from "next/cache";
import { getPublicDb } from "@/lib/data";
import { DbError } from "@/lib/data/db";
import { getAvailability, getSettings, getServices } from "@/lib/queries";
import { availableDays, nextFreeSlot, slotsForDay } from "@/lib/scheduling";
import { addDaysISO, dateISOFromEpoch, dayLabel, isValidDateISO, isoAt, monthBounds, todayISO } from "@/lib/date";
import { digitsOnly } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import type { BookingErrorCode, Service } from "@/lib/types";

const ERROR_MESSAGE: Record<BookingErrorCode, string> = {
  service_not_found: "Esse procedimento não está mais disponível. Escolha outro.",
  invalid_name: "Informe seu nome.",
  invalid_phone: "Informe um WhatsApp válido, com DDD.",
  invalid_kind: "Tipo de agendamento inválido.",
  too_soon: "Esse horário já não aceita agendamento. Escolha um mais adiante.",
  too_far: "Ainda não abrimos agenda para essa data.",
  outside_hours: "Esse horário está fora do atendimento. Escolha outro.",
  blocked: "Esse horário ficou indisponível. Escolha outro.",
  conflict: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro.",
  unknown: "Não foi possível concluir o agendamento. Tente novamente ou chame no WhatsApp.",
};

async function context(service: Service, fromISO: string, toISO: string) {
  const [settings, availability, busy] = await Promise.all([
    getSettings(),
    getAvailability(),
    getPublicDb().busy(isoAt(fromISO, "00:00"), isoAt(addDaysISO(toISO, 1), "00:00")),
  ]);
  return { settings, availability, busy };
}

async function findService(serviceId: string): Promise<Service | null> {
  return (await getServices()).find((s) => s.id === serviceId) ?? null;
}

/** Datas do mês com horário livre para o serviço. */
export async function getMonthAvailability(serviceId: string, month: string): Promise<{ days: string[] } | { error: string }> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };
  const service = await findService(serviceId);
  if (!service) return { error: ERROR_MESSAGE.service_not_found };
  const { first, last } = monthBounds(month);
  const ctx = await context(service, first, last);
  return { days: availableDays(first, last, service.duration_minutes, ctx) };
}

/** Horários livres de um dia. */
export async function getDaySlots(serviceId: string, dateISO: string): Promise<{ slots: string[] } | { error: string }> {
  if (!isValidDateISO(dateISO)) return { error: "Data inválida." };
  const service = await findService(serviceId);
  if (!service) return { error: ERROR_MESSAGE.service_not_found };
  const ctx = await context(service, dateISO, dateISO);
  return { slots: slotsForDay(dateISO, service.duration_minutes, ctx) };
}

/** Próximo horário livre da agenda (usa a menor duração ativa). Alimenta o início e a seção de agendamento. */
export async function getNextSlot(): Promise<{ dateISO: string; time: string; label: string } | null> {
  const services = await getServices();
  if (!services.length) return null;
  const minDuration = Math.min(...services.map((s) => s.duration_minutes));
  const start = todayISO();
  const settings = await getSettings();
  const end = dateISOFromEpoch(Date.now() + settings.max_days_ahead * 86_400_000);
  const [availability, busy] = await Promise.all([getAvailability(), getPublicDb().busy(isoAt(start, "00:00"), isoAt(addDaysISO(end, 1), "00:00"))]);
  const slot = nextFreeSlot(minDuration, { settings, availability, busy });
  return slot ? { ...slot, label: `${dayLabel(slot.dateISO, "short")} às ${slot.time}` } : null;
}

export interface CreateBookingInput {
  serviceId: string;
  dateISO: string;
  time: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export type CreateBookingResult =
  | { ok: true; whatsappUrl: string | null; autoConfirmed: boolean }
  | { ok: false; error: string; field?: "name" | "phone" | "email" };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const name = input.name.trim();
  const phone = digitsOnly(input.phone);
  const email = input.email?.trim() ?? "";

  if (name.length < 2) return { ok: false, error: ERROR_MESSAGE.invalid_name, field: "name" };
  if (phone.length < 10 || phone.length > 11) return { ok: false, error: ERROR_MESSAGE.invalid_phone, field: "phone" };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Esse e-mail não parece válido.", field: "email" };
  if (!isValidDateISO(input.dateISO) || !/^\d{2}:\d{2}$/.test(input.time)) return { ok: false, error: "Escolha data e horário." };

  const service = await findService(input.serviceId);
  if (!service) return { ok: false, error: ERROR_MESSAGE.service_not_found };

  // Confere se o horário ainda está livre (feedback amigável); o banco decide de fato.
  const ctx = await context(service, input.dateISO, input.dateISO);
  if (!slotsForDay(input.dateISO, service.duration_minutes, ctx).includes(input.time)) {
    return { ok: false, error: ERROR_MESSAGE.conflict };
  }

  try {
    await getPublicDb().createBooking({
      serviceId: service.id,
      startsAtISO: isoAt(input.dateISO, input.time),
      name,
      phone,
      email: email || undefined,
      notes: input.notes?.trim() || undefined,
    });
  } catch (err) {
    if (err instanceof DbError && err.code === "not_configured") {
      return { ok: false, error: "O agendamento online ainda não está ativo neste ambiente." };
    }
    const code = (err instanceof DbError ? err.code : "unknown") as BookingErrorCode;
    console.error("[createBooking]", err);
    return { ok: false, error: ERROR_MESSAGE[code] ?? ERROR_MESSAGE.unknown };
  }

  const settings = await getSettings();
  const message = `Olá! Agendei pelo site: ${service.name}, ${dayLabel(input.dateISO)} às ${input.time}. Meu nome é ${name}.`;
  revalidatePath("/admin", "layout");
  return { ok: true, whatsappUrl: whatsappLink(settings.whatsapp, message), autoConfirmed: settings.auto_confirm };
}
