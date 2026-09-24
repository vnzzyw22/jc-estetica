import Link from "next/link";
import { AboutBlock } from "@/components/site/about-block";
import { BookingTeaser } from "@/components/site/booking-teaser";
import { Closing } from "@/components/site/closing";
import { FaqList } from "@/components/site/faq-list";
import { GalleryStrip } from "@/components/site/gallery-strip";
import { Hero } from "@/components/site/hero";
import { Philosophy } from "@/components/site/philosophy";
import { Procedures } from "@/components/site/procedures";
import { getContent, getFaq, getGallery, getServices, getSettings } from "@/lib/queries";

export const revalidate = 3600;

export default async function HomePage() {
  const [settings, content, services, gallery, faq] = await Promise.all([getSettings(), getContent(), getServices(), getGallery(), getFaq()]);
  const featured = gallery.filter((g) => g.featured);

  return (
    <>
      <Hero settings={settings} content={content} />
      <Philosophy content={content} />

      <section data-section="Procedimentos" className="bg-seda">
        <div className="wrap py-[var(--spacing-section)]">
          <div className="mb-14 grid gap-4 lg:mb-20 lg:grid-cols-12 lg:gap-x-6">
            <h2 className="t-h1 lg:col-span-8">Procedimentos</h2>
            <p className="max-w-[40ch] text-cafe lg:col-span-4 lg:self-end">Escolha uma categoria. Duração e valor aparecem antes de você agendar.</p>
          </div>
          <Procedures services={services} />
        </div>
      </section>

      <section data-section="Resultados" className="wrap py-[var(--spacing-section)]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <h2 className="t-h2">Resultados</h2>
          <Link href="/galeria" className="link-draw font-medium">
            Ver a galeria completa
          </Link>
        </div>
        <GalleryStrip items={featured.length ? featured : gallery.slice(0, 6)} />
      </section>

      <AboutBlock name={settings.business_name} content={content} />
      <BookingTeaser settings={settings} />

      <section data-section="Perguntas" className="wrap py-[var(--spacing-section)]">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-6">
          <h2 className="t-h2 lg:col-span-4">Perguntas frequentes</h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <FaqList items={faq} />
          </div>
        </div>
      </section>

      <Closing settings={settings} />
    </>
  );
}
