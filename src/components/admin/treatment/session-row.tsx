import Link from "next/link";
import { completeSessionAction, scheduleSessionAction } from "@/app/admin/(painel)/tratamentos/actions";
import { SessionChip } from "@/components/admin/treatment/chips";
import { Field } from "@/components/admin/ui";
import { dateBR, dateISOFromEpoch, dateTimeLabel, timeLabel } from "@/lib/date";
import { formatDuration } from "@/lib/format";
import { sessionActions } from "@/lib/treatment";
import type { SessionView } from "@/lib/treatment-data";
import type { Service } from "@/lib/types";

interface SessionRowProps {
  s: SessionView;
  treatmentId: string;
  treatmentStatus: string;
  /** Serviços ativos para escolher ao agendar. */
  services: Service[];
  today: string;
  /** Formulários abrem pela URL (?agendar=id / ?concluir=id). */
  scheduling: boolean;
  completing: boolean;
  scheduleHref: string;
  completeHref: string;
  closeHref: string;
}

/** Uma sessão do tratamento: número, serviço, quando, estado e o que fazer com ela. */
export function SessionRow({ s, treatmentId, treatmentStatus, services, today, scheduling, completing, scheduleHref, completeHref, closeHref }: SessionRowProps) {
  const can = sessionActions(s.status, treatmentStatus);
  const name = s.service?.name ?? "Serviço a definir";

  let when: React.ReactNode = "Sem horário marcado";
  if (s.status === "completed" && s.performed_at) when = `Realizada em ${dateBR(dateISOFromEpoch(Date.parse(s.performed_at)))}`;
  else if (s.status === "cancelled") when = "Cancelada";
  else if (s.appointment) {
    when = (
      <Link href={`/admin/agendamentos/${s.appointment.id}`} className="link-draw">
        {dateTimeLabel(s.appointment.starts_at)}
      </Link>
    );
  }

  const rescheduling = s.appointment !== null && s.status !== "completed" && s.status !== "cancelled";

  return (
    <li data-session={s.number} className="border-b border-linha py-4">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
        <span className="tnum t-small">{s.number}</span>
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="tnum t-small">{when}</p>
        </div>
        <SessionChip status={s.status} />
      </div>

      {(can.schedule || can.complete) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 pl-[2.75rem]">
          {can.schedule && (
            <Link href={scheduleHref} scroll={false} className="link-draw min-h-9 text-[0.9rem] font-medium text-bisturi">
              {rescheduling ? "Remarcar" : "Agendar"}
            </Link>
          )}
          {can.complete && (
            <Link href={completeHref} scroll={false} className="link-draw min-h-9 text-[0.9rem]">
              Marcar como realizada
            </Link>
          )}
        </div>
      )}

      {scheduling && can.schedule && (
        <form action={scheduleSessionAction} className="mt-4 ml-[2.75rem] grid max-w-xl gap-4 border-l-2 border-bisturi pl-4 sm:grid-cols-2">
          <input type="hidden" name="treatment_id" value={treatmentId} />
          <input type="hidden" name="session_id" value={s.id} />
          <Field label="Data">
            <input type="date" name="date" min={today} required defaultValue={s.appointment ? dateISOFromEpoch(Date.parse(s.appointment.starts_at)) : today} className="field tnum" />
          </Field>
          <Field label="Horário">
            <input type="time" name="time" step={300} required defaultValue={s.appointment ? timeLabel(s.appointment.starts_at) : ""} className="field tnum" />
          </Field>
          <Field label="Serviço" hint="Pode trocar só para esta sessão.">
            <select name="service_id" defaultValue={s.service_id ?? ""} className="field">
              <option value="">{s.service_id ? "Manter o atual" : "Sem serviço definido"}</option>
              {services.map((sv) => (
                <option key={sv.id} value={sv.id}>
                  {sv.name} ({formatDuration(sv.duration_minutes)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duração (min)" hint="Vazio: a do serviço (ou 60).">
            <input type="number" name="duration" min={5} max={480} step={5} className="field tnum" />
          </Field>
          <div className="flex items-center gap-4 sm:col-span-2">
            <button type="submit" className="btn btn-sm">
              {rescheduling ? "Remarcar sessão" : "Agendar sessão"}
            </button>
            <Link href={closeHref} scroll={false} className="link-draw text-[0.9rem]">
              Fechar
            </Link>
          </div>
        </form>
      )}

      {completing && can.complete && (
        <form action={completeSessionAction} className="mt-4 ml-[2.75rem] grid max-w-xl gap-4 border-l-2 border-bisturi pl-4">
          <input type="hidden" name="treatment_id" value={treatmentId} />
          <input type="hidden" name="session_id" value={s.id} />
          <Field label="Como foi a sessão (opcional)" hint="Vira um registro de evolução do tratamento. Não é diagnóstico.">
            <textarea name="notes" rows={4} maxLength={4000} className="field" />
          </Field>
          <div className="flex items-center gap-4">
            <button type="submit" className="btn btn-sm">
              Marcar como realizada
            </button>
            <Link href={closeHref} scroll={false} className="link-draw text-[0.9rem]">
              Fechar
            </Link>
          </div>
        </form>
      )}
    </li>
  );
}
