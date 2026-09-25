import { OriginCapture } from "@/components/screening/origin-capture";
import { Footer } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { Ruler } from "@/components/site/ruler";
import { getAvailability, getSettings } from "@/lib/queries";
import { SITE_URL } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, availability] = await Promise.all([getSettings(), getAvailability()]);

  // Dados estruturados só com o que é real: campos vazios ficam de fora.
  const sameAs = settings.instagram ? [`https://instagram.com/${settings.instagram.replace(/^@/, "")}`] : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: settings.business_name,
    description: settings.business_tagline,
    url: SITE_URL,
    ...(settings.address ? { address: { "@type": "PostalAddress", streetAddress: settings.address, addressLocality: settings.city ?? undefined, addressCountry: "BR" } } : {}),
    ...(whatsappLink(settings.whatsapp) ? { telephone: settings.whatsapp } : {}),
    ...(sameAs ? { sameAs } : {}),
  };

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-espresso focus:px-4 focus:py-2 focus:text-porcelana">
        Pular para o conteúdo
      </a>
      <OriginCapture />
      <Ruler />
      <Nav name={settings.business_name} />
      <main id="conteudo">{children}</main>
      <Footer settings={settings} availability={availability} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
