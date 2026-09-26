import { FinanceChip } from "@/components/admin/finance/finance-chip";
import { SESSION_STATUS_LABEL, TREATMENT_STATUS_LABEL, type Progress } from "@/lib/treatment";

type Tone = "ok" | "open" | "late" | "muted";

const TREATMENT_TONE: Record<string, Tone> = { proposed: "open", active: "ok", paused: "open", completed: "open", cancelled: "muted" };
const SESSION_TONE: Record<string, Tone> = { unscheduled: "open", scheduled: "open", rescheduled: "open", confirmed: "ok", completed: "ok", cancelled: "muted" };

/** Estado do tratamento. O texto diz o estado; a cor só reforça. */
export function TreatmentChip({ status }: { status: string }) {
  return <FinanceChip tone={TREATMENT_TONE[status] ?? "open"}>{TREATMENT_STATUS_LABEL[status] ?? status}</FinanceChip>;
}

export function SessionChip({ status }: { status: string }) {
  return <FinanceChip tone={SESSION_TONE[status] ?? "open"}>{SESSION_STATUS_LABEL[status] ?? status}</FinanceChip>;
}

/** "3 de 8 sessões" com uma barra fina e o detalhe (agendadas, a agendar). */
export function ProgressLine({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  const counting = progress.total - progress.cancelled;
  return (
    <div>
      <p className="tnum text-[0.95rem]">
        {progress.done} de {counting} {counting === 1 ? "sessão" : "sessões"}
        {progress.cancelled > 0 && <span className="t-small ml-2">{progress.cancelled} cancelada{progress.cancelled === 1 ? "" : "s"}</span>}
      </p>
      <span aria-hidden className="mt-1.5 block h-px bg-linha">
        <span className="block h-px bg-bisturi" style={{ width: `${progress.percent}%` }} />
      </span>
      {!compact && progress.total > 0 && (
        <p className="tnum t-small mt-1.5">
          {progress.booked} com horário, {progress.toSchedule} a agendar
        </p>
      )}
    </div>
  );
}
