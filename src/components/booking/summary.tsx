import { dayLabel } from "@/lib/date";
import { formatDuration, formatPrice } from "@/lib/format";
import type { Service } from "@/lib/types";

interface SummaryProps {
  service: Service | null;
  dateISO: string | null;
  time: string | null;
}

/** A ficha: resume o que já foi escolhido. Vira registro da consulta na confirmação. */
export function Summary({ service, dateISO, time }: SummaryProps) {
  const rows: Array<[string, string | null]> = [
    ["Procedimento", service?.name ?? null],
    ["Duração", service ? formatDuration(service.duration_minutes) : null],
    ["Valor", service ? formatPrice(service.price) : null],
    ["Data", dateISO ? dayLabel(dateISO) : null],
    ["Horário", time],
  ];

  return (
    <dl className="tnum">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-6 border-b border-linha py-3">
          <dt className="t-small">{label}</dt>
          <dd className={value ? "text-right" : "text-right text-cafe/50"}>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
