import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { dateISOFromEpoch, dayLabel, timeLabel } from "@/lib/date";
import { formatDuration } from "@/lib/format";
import type { AppointmentDetail } from "@/lib/types";

/** Uma linha de agendamento: horário, cliente, serviço, status. Leva ao detalhe. */
export function AppointmentLine({ a, showDate = false }: { a: AppointmentDetail; showDate?: boolean }) {
  return (
    <li className="border-b border-linha">
      <Link href={`/admin/agendamentos/${a.id}`} className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-x-4 gap-y-1 py-3.5 transition-colors hover:bg-seda/60 sm:grid-cols-[6.5rem_1fr_auto]">
        <span className="tnum font-medium">
          {showDate && <span className="t-small block font-normal">{dayLabel(dateISOFromEpoch(new Date(a.starts_at).getTime()), "short")}</span>}
          {timeLabel(a.starts_at)}
        </span>
        <span className="min-w-0">
          <span className="block truncate">{a.client?.name ?? "Cliente removido"}</span>
          <span className="t-small block truncate">
            {a.service?.name ?? "Procedimento removido"} · {formatDuration(Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60_000))}
          </span>
        </span>
        <StatusBadge status={a.status} />
      </Link>
    </li>
  );
}
