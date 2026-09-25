import type { Metadata } from "next";
import { ScreeningFlow } from "@/components/screening/screening-flow";
import { getActiveScreeningTerm, getSettings } from "@/lib/queries";
import { AREA_OPTIONS, normalizeCampaign, normalizeSource } from "@/lib/screening";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Descobrir meu tratamento",
  description: "Conte o que você procura em poucas perguntas. A Jennifer analisa e retorna com o caminho mais indicado para você.",
  alternates: { canonical: "/triagem" },
  // Página de formulário: não precisa aparecer com parâmetros de campanha nos buscadores.
  robots: { index: true, follow: true },
};

// Lê ?origem= e ?interesse= a cada acesso.
export const dynamic = "force-dynamic";

type Search = Promise<{ origem?: string; utm_source?: string; campanha?: string; utm_campaign?: string; interesse?: string }>;

export default async function ScreeningPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const [settings, term] = await Promise.all([getSettings(), getActiveScreeningTerm()]);

  const rawOrigin = sp.origem ?? sp.utm_source;
  const origin = rawOrigin ? { source: normalizeSource(rawOrigin), campaign: normalizeCampaign(sp.campanha ?? sp.utm_campaign) ?? undefined } : {};
  const initialArea = AREA_OPTIONS.some((a) => a.value === sp.interesse) ? sp.interesse : undefined;

  // Sem termo de consentimento publicado, só o ambiente de desenvolvimento deixa enviar
  // (o banco também recusa em produção).
  const canSubmit = Boolean(term) || process.env.NODE_ENV !== "production";

  return (
    <div data-section="Triagem" className="wrap pb-[var(--spacing-section)] pt-8 lg:pt-14">
      <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-4">
          <h1 className="t-h1">Descobrir meu tratamento</h1>
          <p className="mt-6 max-w-[34ch] text-cafe">Antes de escolher um procedimento, a Jennifer quer entender o que você precisa.</p>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <noscript>
            <p className="text-cafe">A triagem precisa de JavaScript. Você pode falar direto pelo WhatsApp ou agendar um horário.</p>
          </noscript>
          <ScreeningFlow
            term={term ? { version: term.version, body: term.body } : null}
            canSubmit={canSubmit}
            whatsappHref={whatsappLink(settings.whatsapp, "Olá! Quero descobrir qual tratamento faz sentido para mim.")}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
            origin={origin}
            initialArea={initialArea}
          />
        </div>
      </div>
    </div>
  );
}
