"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { readStoredOrigin } from "@/components/screening/origin-capture";
import { TurnstileField } from "@/components/screening/turnstile";
import { submitScreening } from "@/app/(site)/triagem/actions";
import { maskPhone } from "@/lib/format";
import {
  AREA_OPTIONS,
  CONTACT_OPTIONS,
  DURATION_OPTIONS,
  FIELD_STEP,
  PERIOD_OPTIONS,
  PREVIOUS_OPTIONS,
  VISITS_OPTIONS,
  goalsForArea,
  labels,
  validateScreening,
  type FieldErrors,
  type Option,
  type ScreeningInput,
} from "@/lib/screening";

const DRAFT_KEY = "jc-triagem-v1";
const TOTAL = 5;
const TITLES = ["O que mais incomoda você hoje?", "O que você gostaria de conseguir?", "Um pouco de contexto.", "Sua rotina e preferências.", "Como falamos com você?"];
const SHORT = ["Queixa", "Objetivo", "Contexto", "Rotina", "Contato"];

interface Draft {
  area: string;
  complaint: string;
  goal: string;
  desiredOutcome: string;
  duration: string;
  previous: string;
  notes: string;
  period: string;
  visits: string;
  contactPreference: string;
  name: string;
  phone: string;
  email: string;
}

const EMPTY: Draft = { area: "", complaint: "", goal: "", desiredOutcome: "", duration: "", previous: "", notes: "", period: "", visits: "", contactPreference: "", name: "", phone: "", email: "" };

export interface ScreeningFlowProps {
  /** Termo de consentimento em vigor. Sem termo, só o ambiente de desenvolvimento deixa enviar. */
  term: { version: string; body: string } | null;
  canSubmit: boolean;
  whatsappHref: string | null;
  turnstileSiteKey: string | null;
  /** Origem lida do link (?origem=instagram). Se ausente, usa a guardada na navegação. */
  origin: { source?: string; campaign?: string };
  /** Pré-seleciona a área quando a pessoa chega de uma página de tratamento (?interesse=). */
  initialArea?: string;
}

function readDraft(initialArea?: string): { d: Draft; step: number; t0: number } {
  const seed = { ...EMPTY, area: AREA_OPTIONS.some((a) => a.value === initialArea) ? (initialArea as string) : "" };
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { d: seed, step: 1, t0: Date.now() };
    const parsed = JSON.parse(raw) as { d?: Partial<Draft>; step?: number; t0?: number };
    const step = typeof parsed.step === "number" && parsed.step >= 1 && parsed.step <= TOTAL + 1 ? parsed.step : 1;
    // O instante em que a pessoa começou acompanha o rascunho (voltar depois não zera o relógio anti-robô).
    const t0 = typeof parsed.t0 === "number" && parsed.t0 > 0 ? parsed.t0 : Date.now();
    return { d: { ...seed, ...parsed.d }, step, t0 };
  } catch {
    return { d: seed, step: 1, t0: Date.now() };
  }
}

const noop = () => () => {};

/** O formulário só existe no navegador (usa o rascunho salvo); o servidor entrega a página em volta. */
export function ScreeningFlow(props: ScreeningFlowProps) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return <p className="text-cafe" aria-live="polite">Carregando a triagem…</p>;
  return <Flow {...props} />;
}

function Flow({ term, canSubmit, whatsappHref, turnstileSiteKey, origin, initialArea }: ScreeningFlowProps) {
  const [initial] = useState(() => readDraft(initialArea));
  const [d, setD] = useState<Draft>(initial.d);
  const [step, setStep] = useState<number>(initial.step);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const uid = useId();

  // Rascunho temporário: só nesta aba, some ao fechar. O consentimento nunca é guardado.
  useEffect(() => {
    if (done) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ d, step, t0: initial.t0 }));
    } catch {
      /* modo privado: segue sem rascunho */
    }
  }, [d, step, done, initial.t0]);

  // A cada passo, o foco vai para o título (leitor de tela e teclado seguem o fluxo).
  // Não no primeiro render: a página não deve rolar sozinha ao abrir.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step, done]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setD((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key as keyof FieldErrors] ? { ...prev, [key]: undefined } : prev));
  };

  const input = (): ScreeningInput => ({ ...d, consent });
  const stepErrors = (s: number): FieldErrors => {
    const r = validateScreening(input());
    if (r.ok) return {};
    return Object.fromEntries(Object.entries(r.errors).filter(([k]) => FIELD_STEP[k as keyof ScreeningInput] === s)) as FieldErrors;
  };

  const focusFirstError = (errs: FieldErrors) => {
    const first = Object.keys(errs)[0];
    if (first) requestAnimationFrame(() => document.getElementById(`${uid}-${first}`)?.focus());
  };

  const next = () => {
    if (step <= TOTAL) {
      const errs = stepErrors(step);
      setErrors(errs);
      if (Object.keys(errs).length) {
        focusFirstError(errs);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, TOTAL + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const send = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setSubmitError(null);
    const stored = readStoredOrigin();
    const res = await submitScreening({
      fields: { ...d, consent },
      origin: { source: origin.source ?? stored.source, campaign: origin.campaign ?? stored.campaign },
      honeypot,
      startedAt: initial.t0,
      turnstileToken: token,
    }).catch(() => ({ ok: false as const, error: "Sem conexão. Verifique a internet e tente de novo." }));
    setSending(false);
    if (res.ok) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nada a limpar */
      }
      setDone(true);
      return;
    }
    if ("fieldErrors" in res && res.fieldErrors) {
      setErrors(res.fieldErrors);
      if (res.step) setStep(res.step);
      focusFirstError(res.fieldErrors);
    }
    setSubmitError(res.error);
  }, [sending, d, consent, origin, honeypot, token, initial.t0]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step <= TOTAL) next();
    else void send();
  };

  // ------------------------------------------------------------------ fim
  if (!canSubmit) {
    return (
      <div className="max-w-xl">
        <h2 ref={heading} tabIndex={-1} className="t-h2 outline-none">
          A triagem abre em breve.
        </h2>
        <p className="t-lead mt-6 text-cafe">Enquanto isso, você pode conversar com a Jennifer ou reservar um horário.</p>
        <Actions whatsappHref={whatsappHref} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-xl">
        <h2 ref={heading} tabIndex={-1} className="t-h1 outline-none">
          Triagem enviada.
        </h2>
        <p className="t-lead mt-6 text-cafe">A Jennifer vai analisar suas respostas e retornar pelo contato que você informou.</p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href="/tratamentos" className="btn">
            Conhecer os tratamentos
          </Link>
          <Link href="/" className="link-draw font-medium">
            Voltar ao início
          </Link>
        </div>
        {whatsappHref && (
          <p className="mt-8 text-[0.95rem] text-cafe">
            Quer adiantar alguma coisa?{" "}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="link-draw text-espresso">
              Fale pelo WhatsApp
            </a>
          </p>
        )}
      </div>
    );
  }

  const inReview = step === TOTAL + 1;
  const err = (k: keyof FieldErrors) => errors[k];
  const fid = (k: string) => `${uid}-${k}`;

  return (
    <form onSubmit={onSubmit} noValidate className="pb-28 lg:pb-0" aria-labelledby={`${uid}-title`}>
      <Progress step={inReview ? TOTAL : step} inReview={inReview} />

      <h2 id={`${uid}-title`} ref={heading} tabIndex={-1} className="t-h2 mt-8 max-w-[20ch] outline-none">
        {inReview ? "Confira suas respostas." : TITLES[step - 1]}
      </h2>
      {step === 1 && !inReview && <p className="mt-3 text-cafe">São poucas perguntas, e você revisa tudo antes de enviar.</p>}

      <div className="mt-8 max-w-xl">
        {step === 1 && (
          <div className="grid gap-8">
            <OptionRows legend="Área" name="area" options={AREA_OPTIONS} value={d.area} onChange={(v) => set("area", v)} error={err("area")} id={fid("area")} />
            <Text
              id={fid("complaint")}
              label="Conte com as suas palavras"
              hint="O que você percebe e desde quando incomoda."
              value={d.complaint}
              onChange={(v) => set("complaint", v)}
              error={err("complaint")}
              max={1000}
              rows={4}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-8">
            <OptionRows legend="Objetivo" name="goal" options={goalsForArea(d.area)} value={d.goal} onChange={(v) => set("goal", v)} error={err("goal")} id={fid("goal")} />
            <Text id={fid("desiredOutcome")} label="Como você imagina o resultado? (opcional)" value={d.desiredOutcome} onChange={(v) => set("desiredOutcome", v)} max={600} rows={3} />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-8">
            <OptionRows legend="Há quanto tempo isso incomoda?" name="duration" options={DURATION_OPTIONS} value={d.duration} onChange={(v) => set("duration", v)} id={fid("duration")} optional />
            <OptionRows legend="Você já fez algum tratamento para isso?" name="previous" options={PREVIOUS_OPTIONS} value={d.previous} onChange={(v) => set("previous", v)} id={fid("previous")} optional />
            <Text
              id={fid("notes")}
              label="Algo que a Jennifer deva saber? (opcional)"
              hint="Não precisa detalhar informações de saúde aqui. Isso é conversado na avaliação."
              value={d.notes}
              onChange={(v) => set("notes", v)}
              max={600}
              rows={3}
            />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-8">
            <OptionRows legend="Melhor período para atendimento" name="period" options={PERIOD_OPTIONS} value={d.period} onChange={(v) => set("period", v)} id={fid("period")} optional compact />
            <OptionRows legend="Quantas vezes por mês você consegue vir?" name="visits" options={VISITS_OPTIONS} value={d.visits} onChange={(v) => set("visits", v)} id={fid("visits")} optional compact />
            <OptionRows legend="Como prefere ser contatada?" name="contactPreference" options={CONTACT_OPTIONS} value={d.contactPreference} onChange={(v) => set("contactPreference", v)} id={fid("contactPreference")} optional compact />
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-5">
            <Input id={fid("name")} label="Nome" value={d.name} onChange={(v) => set("name", v)} error={err("name")} autoComplete="name" />
            <Input id={fid("phone")} label="WhatsApp com DDD" value={d.phone} onChange={(v) => set("phone", maskPhone(v))} error={err("phone")} autoComplete="tel-national" type="tel" inputMode="tel" placeholder="(00) 00000-0000" tnum />
            <Input id={fid("email")} label="E-mail (opcional)" value={d.email} onChange={(v) => set("email", v)} error={err("email")} autoComplete="email" type="email" spellCheck={false} />

            <div className="mt-2">
              <p className="mb-2 text-[0.9rem] font-medium">Consentimento{term ? ` (versão ${term.version})` : ""}</p>
              <div tabIndex={0} role="region" aria-label="Texto do termo de consentimento" className="max-h-40 overflow-auto border border-linha bg-seda/60 p-4 text-[0.9rem] leading-relaxed text-cafe">
                {term ? <p className="whitespace-pre-line">{term.body}</p> : <p>[Texto oficial de consentimento: a ser fornecido. Ambiente de desenvolvimento, sem valor real.]</p>}
              </div>
              <label className="mt-4 flex items-start gap-3">
                <input
                  id={fid("consent")}
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    setErrors((p) => ({ ...p, consent: undefined }));
                  }}
                  aria-invalid={Boolean(err("consent"))}
                  aria-describedby={err("consent") ? fid("consent-err") : undefined}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-bisturi)]"
                />
                <span>Li e concordo com o termo acima.</span>
              </label>
              {err("consent") && (
                <p id={fid("consent-err")} role="alert" className="mt-2 text-[0.875rem] text-alerta">
                  {err("consent")}
                </p>
              )}
            </div>

            {turnstileSiteKey && <TurnstileField siteKey={turnstileSiteKey} onToken={setToken} />}

            {/* Campo-isca: invisível para pessoas; bots costumam preenchê-lo. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Não preencha este campo
                <input tabIndex={-1} autoComplete="off" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {inReview && <Review d={d} onEdit={(s) => setStep(s)} term={term} />}

        {submitError && (
          <p role="alert" className="mt-8 border-l-2 border-alerta bg-alerta/5 px-4 py-3 text-[0.95rem] text-alerta">
            {submitError}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-linha bg-porcelana px-[var(--spacing-gutter)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-10 lg:max-w-xl lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
        {step > 1 ? (
          <button type="button" onClick={back} className="btn btn-ghost" disabled={sending}>
            Voltar
          </button>
        ) : (
          <span />
        )}
        <button key={inReview ? "send" : "next"} type="submit" className="btn min-w-40" disabled={sending}>
          {sending ? "Enviando…" : inReview ? "Enviar triagem" : step === TOTAL ? "Revisar" : "Continuar"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Progress({ step, inReview }: { step: number; inReview: boolean }) {
  return (
    <div>
      <ol aria-hidden className="flex gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <li key={i} className={`h-0.5 flex-1 transition-colors duration-[var(--duration-base)] ${i < step || inReview ? "bg-bisturi" : "bg-linha"}`} />
        ))}
      </ol>
      <p className="tnum mt-3 text-[0.875rem] text-cafe" aria-live="polite">
        {inReview ? "Revisão final" : `Passo ${step} de ${TOTAL}, ${SHORT[step - 1].toLowerCase()}`}
      </p>
    </div>
  );
}

function OptionRows({ legend, name, options, value, onChange, error, id, optional, compact }: { legend: string; name: string; options: Option[]; value: string; onChange: (v: string) => void; error?: string; id: string; optional?: boolean; compact?: boolean }) {
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="mb-2 text-[0.9rem] font-medium">
        {legend}
        {optional && <span className="font-normal text-cafe"> (opcional)</span>}
      </legend>
      <div className={`border-t border-linha ${compact ? "grid sm:grid-cols-2 sm:gap-x-6" : ""}`}>
        {options.map((o, i) => (
          <label
            key={o.value}
            className="group flex min-h-14 cursor-pointer items-center justify-between gap-4 border-b border-linha px-1 py-3 transition-colors duration-[var(--duration-quick)] hover:bg-seda/60 has-[:checked]:bg-seda has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bisturi"
          >
            <span>
              <span className="block">{o.label}</span>
              {o.hint && <span className="t-small block">{o.hint}</span>}
            </span>
            <input id={i === 0 ? id : undefined} type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
            <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cafe transition-colors duration-[var(--duration-quick)] peer-checked:border-bisturi peer-checked:after:h-2.5 peer-checked:after:w-2.5 peer-checked:after:rounded-full peer-checked:after:bg-bisturi" />
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-[0.875rem] text-alerta">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Text({ id, label, hint, value, onChange, error, max, rows }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; error?: string; max: number; rows: number }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.9rem] font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="t-small mb-2">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={max}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={[hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined}
        className="field min-h-28 resize-y"
      />
      <div className="mt-1 flex justify-between gap-4">
        {error ? (
          <p id={`${id}-err`} role="alert" className="text-[0.875rem] text-alerta">
            {error}
          </p>
        ) : (
          <span />
        )}
        <span className="tnum t-small">
          {value.length}/{max}
        </span>
      </div>
    </div>
  );
}

function Input({ id, label, value, onChange, error, tnum, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; tnum?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.9rem] font-medium">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} className={`field ${tnum ? "tnum" : ""}`} {...rest} />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-[0.875rem] text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}

function Review({ d, onEdit, term }: { d: Draft; onEdit: (step: number) => void; term: { version: string } | null }) {
  const rows: Array<{ step: number; label: string; value: string | null }> = [
    { step: 1, label: "Área", value: labels.area(d.area) },
    { step: 1, label: "Queixa", value: d.complaint.trim() || null },
    { step: 2, label: "Objetivo", value: labels.goal(d.goal) },
    { step: 2, label: "Resultado imaginado", value: d.desiredOutcome.trim() || null },
    { step: 3, label: "Há quanto tempo", value: labels.duration(d.duration) },
    { step: 3, label: "Tratamento anterior", value: labels.previous(d.previous) },
    { step: 3, label: "Observação", value: d.notes.trim() || null },
    { step: 4, label: "Período", value: labels.period(d.period) },
    { step: 4, label: "Vezes por mês", value: labels.visits(d.visits) },
    { step: 4, label: "Contato por", value: labels.contact(d.contactPreference) },
    { step: 5, label: "Nome", value: d.name.trim() || null },
    { step: 5, label: "WhatsApp", value: d.phone || null },
    { step: 5, label: "E-mail", value: d.email.trim() || null },
    { step: 5, label: "Consentimento", value: term ? `Termo versão ${term.version}` : "Termo de desenvolvimento" },
  ];
  return (
    <dl className="border-t border-linha">
      {rows
        .filter((r) => r.value)
        .map((r) => (
          <div key={r.label} className="grid grid-cols-[7.5rem_1fr_auto] items-baseline gap-x-4 border-b border-linha py-3">
            <dt className="t-small">{r.label}</dt>
            <dd className="min-w-0 break-words">{r.value}</dd>
            <dd>
              <button type="button" onClick={() => onEdit(r.step)} className="link-draw min-h-9 text-[0.875rem]" aria-label={`Alterar ${r.label.toLowerCase()}`}>
                Alterar
              </button>
            </dd>
          </div>
        ))}
    </dl>
  );
}

function Actions({ whatsappHref }: { whatsappHref: string | null }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
      <Link href="/agendamento" className="btn">
        Agendar horário
      </Link>
      {whatsappHref ? (
        <a href={whatsappHref} className="link-draw font-medium" target="_blank" rel="noopener noreferrer">
          Conversar no WhatsApp
        </a>
      ) : (
        <span className="text-cafe">[WhatsApp a informar]</span>
      )}
    </div>
  );
}
