import Link from "next/link";
import { dateTimeLabel } from "@/lib/date";
import type { TimelineItem } from "@/lib/client-file";

/** Tudo o que aconteceu com a cliente, do mais recente ao mais antigo, numa linha só. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="border-l border-linha pl-6">
      {items.map((it, i) => {
        const body = (
          <>
            <span className="tnum t-small block">
              {dateTimeLabel(it.at)}
              {it.upcoming && <span className="ml-2 rounded-ctl border border-bisturi px-1.5 text-[0.75rem] text-bisturi">Agendado</span>}
            </span>
            <span className="mt-0.5 block font-medium">{it.title}</span>
            {it.detail && <span className="t-small block">{it.detail}</span>}
          </>
        );
        return (
          <li key={`${it.kind}-${it.at}-${i}`} className="relative pb-6 last:pb-0">
            <span aria-hidden className={`absolute -left-[calc(1.5rem+4.5px)] top-2 h-2 w-2 rounded-full ${it.upcoming ? "bg-bisturi" : "bg-cafe/50"}`} />
            {it.href ? (
              <Link href={it.href} className="block transition-colors hover:text-bisturi">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
