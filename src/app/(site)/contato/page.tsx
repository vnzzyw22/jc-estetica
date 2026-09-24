import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { summarizeHours } from "@/lib/hours";
import { LOCALITY_PLACEHOLDER } from "@/lib/site";
import { getAvailability, getSettings } from "@/lib/queries";
import { whatsappLink } from "@/lib/whatsapp";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contato",
  description: "WhatsApp, Instagram, endereço e horários de atendimento de Jennifer Camila.",
  alternates: { canonical: "/contato" },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-linha py-6 md:grid-cols-[12rem_1fr] md:gap-6">
      <dt className="t-small">{label}</dt>
      <dd className="text-[1.05rem]">{children}</dd>
    </div>
  );
}

export default async function ContactPage() {
  const [settings, availability] = await Promise.all([getSettings(), getAvailability()]);
  const wa = whatsappLink(settings.whatsapp, "Olá! Vim pelo site.");
  const hours = summarizeHours(availability);
  const handle = settings.instagram?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");

  return (
    <>
      <PageHeader title="Contato" section="Contato" lead="O jeito mais rápido de marcar é pelo agendamento online. Para dúvidas, WhatsApp." />
      <section className="wrap pb-[var(--spacing-section)]">
        <dl className="border-b border-linha lg:max-w-4xl">
          <Row label="WhatsApp">
            {wa ? (
              <a href={wa} className="link-draw" target="_blank" rel="noopener noreferrer">
                Conversar no WhatsApp
              </a>
            ) : (
              <span className="text-cafe">[Número de WhatsApp]</span>
            )}
          </Row>
          <Row label="Instagram">
            {handle ? (
              <a href={`https://instagram.com/${handle}`} className="link-draw" target="_blank" rel="noopener noreferrer">
                @{handle}
              </a>
            ) : (
              <span className="text-cafe">[Instagram]</span>
            )}
          </Row>
          <Row label="Endereço">
            {settings.address ? (
              <address className="not-italic">
                {settings.address}
                {settings.city ? `, ${settings.city}` : ""}
              </address>
            ) : (
              <span className="text-cafe">[Endereço do atendimento], {settings.city || LOCALITY_PLACEHOLDER}</span>
            )}
          </Row>
          <Row label="Atendimento">
            {hours.length ? (
              <ul className="tnum space-y-1">
                {hours.map((h) => (
                  <li key={h.days}>
                    {h.days}, {h.hours}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-cafe">[Horários de atendimento]</span>
            )}
          </Row>
          {settings.email && (
            <Row label="E-mail">
              <a href={`mailto:${settings.email}`} className="link-draw">
                {settings.email}
              </a>
            </Row>
          )}
        </dl>

        <Link href="/agendamento" className="btn mt-12">
          Agendar horário
        </Link>
      </section>
    </>
  );
}
