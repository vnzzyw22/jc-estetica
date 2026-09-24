"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getNextSlot } from "@/app/(site)/agendamento/actions";

type Slot = { dateISO: string; time: string; label: string } | null;

/** Próximo horário livre, direto da agenda. Busca no cliente para a página seguir cacheável. */
export function NextSlot({ className = "" }: { className?: string }) {
  const [slot, setSlot] = useState<Slot | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getNextSlot()
      .then((s) => alive && setSlot(s))
      .catch(() => alive && setSlot(null));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link href="/agendamento" className={`link-draw tnum ${className}`} aria-live="polite">
      {slot === undefined ? "Consultando a agenda…" : slot ? `Próximo horário livre: ${slot.label}` : "Ver horários disponíveis"}
    </Link>
  );
}
