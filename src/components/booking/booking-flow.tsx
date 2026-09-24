"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/booking/calendar";
import { Summary } from "@/components/booking/summary";
import { createBooking, getDaySlots, getMonthAvailability, type CreateBookingResult } from "@/app/(site)/agendamento/actions";
import { dayLabel, shiftMonth } from "@/lib/date";
import { CATEGORY_LABEL, formatDuration, formatPrice, maskPhone } from "@/lib/format";
import type { Service } from "@/lib/types";

interface BookingFlowProps {
  services: Service[];
  today: string;
  maxDate: string;
  initialServiceId: string | null;
}

type Step = 1 | 2 | 3;
type Done = Extract<CreateBookingResult, { ok: true }>;

const STEP_TITLES: Record<Step, string> = { 1: "Procedimento", 2: "Data e horário", 3: "Seus dados" };

const CATEGORY_ORDER = ["facial", "corporal", "tratamentos", "protocolos"] as const;

export function BookingFlow({ services, today, maxDate, initialServiceId }: BookingFlowProps) {
  const currentMonth = today.slice(0, 7);
  const lastMonth = maxDate.slice(0, 7);

  const [step, setStep] = useState<Step>(initialServiceId ? 2 : 1);
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);
  const [month, setMonth] = useState(currentMonth);
  const [days, setDays] = useState<Set<string>>(new Set());
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  // Ignora respostas de requisições antigas (troca rápida de mês/dia/serviço).
  const monthReq = useRef(0);
  const slotsReq = useRef(0);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;

  async function loadMonth(id: string, target: string, autoAdvance: boolean) {
    const req = ++monthReq.current;
    setMonthLoading(true);
    setMonthError(null);
    const res = await getMonthAvailability(id, target).catch(() => ({ error: "Não foi possível consultar a agenda." }));
    if (req !== monthReq.current) return;
    if ("error" in res) {
      setMonthError(res.error);
      setMonthLoading(false);
      return;
    }
    setDays(new Set(res.days));
    setMonth(target);
    setMonthLoading(false);
    if (autoAdvance && res.days.length === 0 && target < lastMonth) {
      void loadMonth(id, shiftMonth(target, 1), true);
    }
  }

  async function loadSlots(id: string, target: string) {
    const req = ++slotsReq.current;
    setSlotsLoading(true);
    setSlotsError(null);
    const res = await getDaySlots(id, target).catch(() => ({ error: "Não foi possível consultar os horários." }));
    if (req !== slotsReq.current) return;
    if ("error" in res) setSlotsError(res.error);
    else setSlots(res.slots);
    setSlotsLoading(false);
  }

  // Serviço pré-selecionado por ?servico=slug: já abre a agenda dele.
  useEffect(() => {
    if (initialServiceId) void loadMonth(initialServiceId, currentMonth, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done) doneHeading.current?.focus();
  }, [done]);

  function chooseService(id: string) {
    setServiceId(id);
    setDate(null);
    setTime(null);
    setSlots([]);
    setStep(2);
    void loadMonth(id, currentMonth, true);
  }

  function chooseDate(d: string) {
    if (!serviceId) return;
    setDate(d);
    setTime(null);
    void loadSlots(serviceId, d);
  }

  function changeMonth(delta: number) {
    if (!serviceId) return;
    setDate(null);
    setTime(null);
    setSlots([]);
    void loadMonth(serviceId, shiftMonth(month, delta), false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !date || !time || submitting) return;
    setSubmitting(true);
    setFieldError(null);
    const res = await createBooking({ serviceId: service.id, dateISO: date, time, ...form }).catch(
      (): CreateBookingResult => ({ ok: false, error: "Sem conexão. Verifique a internet e tente de novo." }),
    );
    setSubmitting(false);
    if (res.ok) {
      setDone(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (res.field) {
      setFieldError({ field: res.field, message: res.error });
      document.getElementById(`campo-${res.field}`)?.focus();
      return;
    }
    // Conflito de horário e afins: volta para escolher outro, com a agenda atualizada.
    setFieldError({ message: res.error });
    setTime(null);
    setStep(2);
    void loadSlots(service.id, date);
    void loadMonth(service.id, month, false);
  }

  if (done && service && date && time) {
    return (
      <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-7">
          <h2 ref={doneHeading} tabIndex={-1} className="t-h1 outline-none">
            {done.autoConfirmed ? "Horário confirmado." : "Horário reservado."}
          </h2>
          <p className="t-lead mt-6 max-w-[32ch] text-cafe">
            {done.autoConfirmed ? "Está tudo certo. Até lá." : "A Jennifer confirma com você por WhatsApp. Até a confirmação, o horário fica reservado para você."}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            {done.whatsappUrl && (
              <a href={done.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn">
                Avisar no WhatsApp
              </a>
            )}
            <Link href="/" className="link-draw font-medium">
              Voltar ao início
            </Link>
          </div>
        </div>
        <div className="lg:col-span-4 lg:col-start-9">
          <p className="t-small mb-2">Resumo</p>
          <Summary service={service} dateISO={date} time={time} />
        </div>
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.map((c) => ({ c, list: services.filter((s) => s.category === c) })).filter((g) => g.list.length);
  const canContinue2 = Boolean(date && time);
  const canPrevMonth = month > currentMonth;
  const canNextMonth = month < lastMonth;

  // Ação primária única, refletida na ficha (desktop) e na barra fixa (mobile).
  const primary =
    step === 2
      ? { label: "Continuar", disabled: !canContinue2, onClick: (e: React.MouseEvent) => { e.preventDefault(); setStep(3); }, form: undefined }
      : step === 3
        ? { label: submitting ? "Enviando…" : "Confirmar agendamento", disabled: submitting, onClick: undefined, form: "form-agendamento" }
        : null;

  const stepHeader = (n: Step, summary: string | null) => {
    const reached = n <= step;
    const complete = n < step && summary;
    return (
      <div className="flex items-baseline gap-4">
        <span className={`tnum w-6 text-[0.9rem] ${reached ? "text-bisturi" : "text-cafe/40"}`}>{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className={`t-h3 ${reached ? "" : "text-cafe/40"}`}>{STEP_TITLES[n]}</h2>
          {complete && <p className="tnum mt-1 truncate text-[0.9rem] text-cafe">{summary}</p>}
        </div>
        {complete && (
          <button type="button" className="link-draw min-h-11 text-[0.9rem]" onClick={() => setStep(n)}>
            Alterar
          </button>
        )}
      </div>
    );
  };

  const panel = (n: Step) => `grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-[var(--ease-soft)] ${step === n ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`;

  return (
    <div className="grid gap-x-6 gap-y-10 pb-28 lg:grid-cols-12 lg:pb-0">
      <div className="lg:col-span-7">
        {fieldError && !fieldError.field && (
          <p role="alert" className="mb-8 border-l-2 border-alerta bg-alerta/5 px-4 py-3 text-[0.95rem] text-alerta">
            {fieldError.message}
          </p>
        )}

        {/* 1 — Procedimento */}
        <section aria-labelledby="passo-1" className="border-t border-linha py-6">
          <div id="passo-1">{stepHeader(1, service?.name ?? null)}</div>
          <div className={panel(1)}>
            <div className="overflow-hidden" inert={step !== 1}>
              <div role="group" aria-label="Procedimentos" className="mt-6 space-y-8 pb-2">
                {grouped.map(({ c, list }) => (
                  <div key={c}>
                    <p className="t-small mb-1">{CATEGORY_LABEL[c]}</p>
                    <ul className="border-t border-linha">
                      {list.map((s) => {
                        const checked = s.id === serviceId;
                        return (
                          <li key={s.id} className="border-b border-linha">
                            <button
                              type="button"
                              aria-pressed={checked}
                              onClick={() => chooseService(s.id)}
                              className={`grid w-full gap-x-6 gap-y-1 border-l-2 px-4 py-4 text-left transition-colors duration-[var(--duration-quick)] sm:grid-cols-[1fr_auto] ${
                                checked ? "border-bisturi bg-seda" : "border-transparent hover:bg-seda/60"
                              }`}
                            >
                              <span>
                                <span className="block font-serif text-[1.3rem] font-light leading-snug">{s.name}</span>
                                {s.indication && <span className="mt-0.5 block text-[0.875rem] text-cafe">{s.indication}</span>}
                              </span>
                              <span className="tnum text-[0.95rem] text-cafe sm:text-right">
                                <span>{formatDuration(s.duration_minutes)}</span>{" "}<span className="ml-3">{formatPrice(s.price)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2 — Data e horário */}
        <section aria-labelledby="passo-2" className="border-t border-linha py-6">
          <div id="passo-2">{stepHeader(2, date && time ? `${dayLabel(date, "short")} às ${time}` : null)}</div>
          <div className={panel(2)}>
            <div className="overflow-hidden" inert={step !== 2}>
              <div className="mt-6 grid gap-x-10 gap-y-8 pb-2 md:grid-cols-[minmax(0,20rem)_1fr]">
                <div className="max-w-80">
                  {monthError ? (
                    <div role="alert" className="text-[0.95rem] text-alerta">
                      {monthError}{" "}
                      <button type="button" className="link-draw" onClick={() => serviceId && loadMonth(serviceId, month, false)}>
                        Tentar de novo
                      </button>
                    </div>
                  ) : (
                    <Calendar
                      month={month}
                      today={today}
                      availableDays={days}
                      selected={date}
                      loading={monthLoading}
                      canPrev={canPrevMonth && !monthLoading}
                      canNext={canNextMonth && !monthLoading}
                      onPrev={() => changeMonth(-1)}
                      onNext={() => changeMonth(1)}
                      onSelect={chooseDate}
                    />
                  )}
                  {!monthLoading && !monthError && days.size === 0 && (
                    <p className="mt-4 text-[0.95rem] text-cafe">Sem horários livres neste mês.</p>
                  )}
                </div>

                <div aria-live="polite" aria-busy={slotsLoading}>
                  {!date ? (
                    <p className="text-[0.95rem] text-cafe">{monthLoading ? "Consultando a agenda…" : "Escolha uma data para ver os horários."}</p>
                  ) : slotsLoading ? (
                    <p className="text-[0.95rem] text-cafe">Consultando horários…</p>
                  ) : slotsError ? (
                    <p role="alert" className="text-[0.95rem] text-alerta">
                      {slotsError}
                    </p>
                  ) : slots.length === 0 ? (
                    <p className="text-[0.95rem] text-cafe">Nenhum horário livre em {dayLabel(date, "short")}. Escolha outra data.</p>
                  ) : (
                    <div>
                      <p className="t-small mb-3">Horários em {dayLabel(date)}</p>
                      <div role="group" aria-label="Horários disponíveis" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((t) => (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={t === time}
                            onClick={() => setTime(t)}
                            className={`tnum min-h-11 rounded-ctl border px-2 text-[0.975rem] transition-colors duration-[var(--duration-quick)] ${
                              t === time ? "border-espresso bg-espresso text-porcelana" : "border-linha hover:border-espresso"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 — Dados */}
        <section aria-labelledby="passo-3" className="border-y border-linha py-6">
          <div id="passo-3">{stepHeader(3, null)}</div>
          <div className={panel(3)}>
            <div className="overflow-hidden" inert={step !== 3}>
              <form id="form-agendamento" onSubmit={submit} noValidate className="mt-6 grid max-w-xl gap-5 pb-2">
                <Field id="campo-name" label="Nome" error={fieldError?.field === "name" ? fieldError.message : undefined}>
                  <input
                    id="campo-name"
                    className="field"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    aria-invalid={fieldError?.field === "name"}
                    aria-describedby={fieldError?.field === "name" ? "erro-name" : undefined}
                  />
                </Field>
                <Field id="campo-phone" label="WhatsApp com DDD" error={fieldError?.field === "phone" ? fieldError.message : undefined}>
                  <input
                    id="campo-phone"
                    className="field tnum"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(00) 00000-0000"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                    aria-invalid={fieldError?.field === "phone"}
                    aria-describedby={fieldError?.field === "phone" ? "erro-phone" : undefined}
                  />
                </Field>
                <Field id="campo-email" label="E-mail (opcional)" error={fieldError?.field === "email" ? fieldError.message : undefined}>
                  <input
                    id="campo-email"
                    className="field"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    aria-invalid={fieldError?.field === "email"}
                    aria-describedby={fieldError?.field === "email" ? "erro-email" : undefined}
                  />
                </Field>
                <Field id="campo-notes" label="Algo que a Jennifer deva saber (opcional)">
                  <textarea id="campo-notes" className="field min-h-24 resize-y" rows={3} autoComplete="off" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </form>
            </div>
          </div>
        </section>
      </div>

      {/* Ficha — desktop */}
      <aside className="hidden lg:col-span-4 lg:col-start-9 lg:block" aria-label="Resumo do agendamento">
        <div className="sticky top-28">
          <p className="t-small mb-2">Sua ficha</p>
          <Summary service={service} dateISO={date} time={time} />
          <div className="mt-8">
            {primary ? (
              <button key={step} type={primary.form ? "submit" : "button"} form={primary.form} className="btn w-full" disabled={primary.disabled} onClick={primary.onClick}>
                {primary.label}
              </button>
            ) : (
              <p className="text-[0.95rem] text-cafe">Escolha um procedimento para começar.</p>
            )}
          </div>
        </div>
      </aside>

      {/* Barra fixa — mobile */}
      {primary && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-porcelana px-[var(--spacing-gutter)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="tnum mb-2 truncate text-[0.875rem] text-cafe">
            {service ? service.name : "—"}
            {date && time ? `, ${dayLabel(date, "short")} às ${time}` : ""}
          </div>
          <button key={step} type={primary.form ? "submit" : "button"} form={primary.form} className="btn w-full" disabled={primary.disabled} onClick={primary.onClick}>
            {primary.label}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.9rem] font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={id.replace("campo-", "erro-")} role="alert" className="mt-1.5 text-[0.875rem] text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
