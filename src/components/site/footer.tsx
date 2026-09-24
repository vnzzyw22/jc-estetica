import Link from "next/link";
import { summarizeHours } from "@/lib/hours";
import { NAV_LINKS, LOCALITY_PLACEHOLDER } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";
import type { AvailabilityRow, Settings } from "@/lib/types";

export function Footer({ settings, availability }: { settings: Settings; availability: AvailabilityRow[] }) {
  const wa = whatsappLink(settings.whatsapp);
  const hours = summarizeHours(availability);
  const instagramHandle = settings.instagram?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");

  return (
    <footer className="on-dark bg-espresso text-porcelana">
      <div className="wrap pb-10 pt-[var(--spacing-section)]">
        <p className="t-name select-none" aria-hidden>
          {settings.business_name}
        </p>

        <div className="mt-14 grid gap-12 border-t border-linha-clara pt-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="font-serif text-xl font-light leading-snug">{settings.business_tagline}</p>
            <p className="mt-2 text-[0.95rem] opacity-70">{settings.city || LOCALITY_PLACEHOLDER}</p>
          </div>

          <address className="not-italic md:col-span-4">
            <p className="text-[0.8125rem] opacity-60">Contato</p>
            <ul className="mt-3 space-y-1.5">
              <li>
                {wa ? (
                  <a href={wa} className="link-draw" target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                ) : (
                  <span className="opacity-70">[Número de WhatsApp]</span>
                )}
              </li>
              <li>
                {instagramHandle ? (
                  <a href={`https://instagram.com/${instagramHandle}`} className="link-draw" target="_blank" rel="noopener noreferrer">
                    Instagram @{instagramHandle}
                  </a>
                ) : (
                  <span className="opacity-70">[Instagram]</span>
                )}
              </li>
              <li className="opacity-80">{settings.address || "[Endereço do atendimento]"}</li>
            </ul>
          </address>

          <div className="md:col-span-4">
            <p className="text-[0.8125rem] opacity-60">Atendimento</p>
            <ul className="tnum mt-3 space-y-1.5">
              {hours.length ? (
                hours.map((h) => (
                  <li key={h.days} className="flex justify-between gap-6 border-b border-linha-clara pb-1.5 md:max-w-64">
                    <span>{h.days}</span>
                    <span className="opacity-80">{h.hours}</span>
                  </li>
                ))
              ) : (
                <li className="opacity-70">[Horários de atendimento]</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 text-[0.8125rem] opacity-70 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="link-draw">
                {l.label}
              </Link>
            ))}
          </nav>
          <p>© {new Date().getFullYear()} {settings.business_name}</p>
        </div>
      </div>
    </footer>
  );
}
