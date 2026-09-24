"use client";

import { addDaysISO, monthBounds, monthName, weekdayOf } from "@/lib/date";

interface CalendarProps {
  month: string; // YYYY-MM
  today: string;
  availableDays: Set<string>;
  selected: string | null;
  loading: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (dateISO: string) => void;
}

const HEADERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const HEADER_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Calendário mensal. Células de 44px: cabe em 360px sem esmagar o toque. */
export function Calendar({ month, today, availableDays, selected, loading, canPrev, canNext, onPrev, onNext, onSelect }: CalendarProps) {
  const { first, days } = monthBounds(month);
  const lead = weekdayOf(first);
  const [year, m] = month.split("-").map(Number);

  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => addDaysISO(first, i)),
  ];

  const nav = "inline-flex h-11 w-11 items-center justify-center rounded-ctl border border-linha transition-colors duration-[var(--duration-quick)] hover:border-espresso disabled:opacity-30 disabled:hover:border-linha";

  return (
    <div aria-busy={loading}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-[1.6rem] font-light capitalize leading-none tracking-[-0.01em]" aria-live="polite">
          {monthName(m - 1)} <span className="tnum text-cafe">{year}</span>
        </h3>
        <div className="flex gap-2">
          <button type="button" className={nav} onClick={onPrev} disabled={!canPrev} aria-label="Mês anterior">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <button type="button" className={nav} onClick={onNext} disabled={!canNext} aria-label="Próximo mês">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>

      <div role="group" aria-label={`Datas de ${monthName(m - 1)} de ${year}`} className="grid grid-cols-7 gap-y-1">
        {HEADERS.map((h, i) => (
          <div key={i} aria-hidden title={HEADER_FULL[i]} className="t-small py-2 text-center">
            {h}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} aria-hidden />;
          const day = Number(d.slice(8));
          const available = availableDays.has(d);
          const isSelected = d === selected;
          const isToday = d === today;
          return (
            <div key={d} className="flex justify-center">
              <button
                type="button"
                disabled={!available || loading}
                aria-pressed={isSelected}
                aria-label={`${day} de ${monthName(m - 1)}${isToday ? ", hoje" : ""}${available ? "" : ", sem horários"}`}
                onClick={() => onSelect(d)}
                className={`tnum relative h-11 w-11 rounded-ctl text-[0.975rem] transition-colors duration-[var(--duration-quick)] ${
                  isSelected
                    ? "bg-espresso text-porcelana"
                    : available
                      ? "text-espresso hover:bg-seda"
                      : "text-cafe/35"
                } ${isToday && !isSelected ? "after:absolute after:bottom-1.5 after:left-1/2 after:h-px after:w-3 after:-translate-x-1/2 after:bg-bisturi" : ""}`}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
