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
    // Duração provisória e valor vazio não aparecem: nada de "sob avaliação" repetido.
    ...(service?.duration_confirmed ? ([["Duração", formatDuration(service.duration_minutes)]] as Array<[string, string | null]>) : []),
    ...(service && service.price != null ? ([["Valor", formatPrice(service.price)]] as Array<[string, string | null]>) : []),
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
