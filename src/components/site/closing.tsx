import Link from "next/link";
import { whatsappLink } from "@/lib/whatsapp";
import type { Settings } from "@/lib/types";

/** Fechamento: uma linha grande e clicável, sem botão gigante. */
export function Closing({ settings }: { settings: Settings }) {
  const wa = whatsappLink(settings.whatsapp);
  return (
    <section data-section="Contato" className="wrap py-[var(--spacing-section)]">
      <Link
        href="/agendamento"
        className="group flex flex-col gap-4 border-y border-espresso py-10 transition-colors duration-[var(--duration-base)] hover:bg-seda md:flex-row md:items-end md:justify-between md:py-14"
      >
        <span className="t-h1">Marque seu horário.</span>
        <span className="link-draw self-start text-[1.05rem] font-medium md:self-auto">Escolher procedimento e data</span>
      </Link>
      <p className="mt-6 text-[0.95rem] text-cafe">
        Prefere conversar antes?{" "}
        {wa ? (
          <a href={wa} className="link-draw text-espresso" target="_blank" rel="noopener noreferrer">
            Chame no WhatsApp
          </a>
        ) : (
          <span>[WhatsApp a informar]</span>
        )}
        .
      </p>
    </section>
  );
}
