import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { getSettings } from "@/lib/queries";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Descobrir meu tratamento",
  description: "Conte o que você procura e a Jennifer indica o caminho. Triagem rápida, sem compromisso.",
  alternates: { canonical: "/triagem" },
};

// Página provisória: a triagem interativa entra na próxima etapa. Enquanto isso, os dois
// caminhos que já funcionam ficam à mão.
export default async function ScreeningPage() {
  const settings = await getSettings();
  const wa = whatsappLink(settings.whatsapp, "Olá! Quero descobrir qual tratamento faz sentido para mim.");

  return (
    <>
      <PageHeader title="Descobrir meu tratamento" section="Triagem" lead="Estamos preparando a triagem: poucas perguntas, uma de cada vez." />
      <section className="wrap pb-[var(--spacing-section)]">
        <p className="t-lead max-w-[34ch]">Até lá, você pode conversar direto com a Jennifer ou reservar um horário.</p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href="/agendamento" className="btn">
            Agendar horário
          </Link>
          {wa ? (
            <a href={wa} className="link-draw font-medium" target="_blank" rel="noopener noreferrer">
              Conversar no WhatsApp
            </a>
          ) : (
            <span className="text-cafe">[WhatsApp a informar]</span>
          )}
        </div>
      </section>
    </>
  );
}
