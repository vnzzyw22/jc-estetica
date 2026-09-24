import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageFrame } from "@/components/site/photo";
import { CATEGORY_LABEL, formatDuration, formatPrice } from "@/lib/format";
import { getServiceBySlug, getServices } from "@/lib/queries";

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return (await getServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const service = await getServiceBySlug((await params).slug);
  if (!service) return {};
  return {
    title: service.name,
    description: service.description ?? `${service.name} — ${CATEGORY_LABEL[service.category]}. Agende online.`,
    alternates: { canonical: `/servicos/${service.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [service, all] = await Promise.all([getServiceBySlug(slug), getServices()]);
  if (!service) notFound();

  const related = all.filter((s) => s.category === service.category && s.id !== service.id);

  return (
    <article data-section={CATEGORY_LABEL[service.category]} className="wrap pb-[var(--spacing-section)] pt-8 lg:pt-14">
      <nav aria-label="Trilha" className="t-small mb-8">
        <Link href="/servicos" className="link-draw">
          Procedimentos
        </Link>{" "}
        / {CATEGORY_LABEL[service.category]}
      </nav>

      <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-6">
          <h1 className="t-h1">{service.name}</h1>
          {service.description && <p className="t-lead mt-8 max-w-[34ch]">{service.description}</p>}

          <dl className="tnum mt-12 max-w-md">
            {[
              ["Duração", formatDuration(service.duration_minutes)],
              ["Valor", formatPrice(service.price)],
              ...(service.indication ? [["Indicação", service.indication]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-6 border-t border-linha py-4 last:border-b">
                <dt className="t-small">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>

          <Link href={`/agendamento?servico=${service.slug}`} className="btn mt-10">
            Agendar este procedimento
          </Link>
        </div>

        <div className="lg:col-span-5 lg:col-start-8">
          <ImageFrame url={service.image_url} caption="[Foto do procedimento]" alt={service.name} ratio="4 / 5" sizes="(min-width: 1024px) 40vw, 100vw" priority />
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-24">
          <h2 className="t-h3 mb-4">Também em {CATEGORY_LABEL[service.category].toLowerCase()}</h2>
          <ul className="border-t border-linha">
            {related.map((s) => (
              <li key={s.id} className="border-b border-linha">
                <Link href={`/servicos/${s.slug}`} className="flex items-baseline justify-between gap-6 py-4 transition-colors duration-[var(--duration-quick)] hover:text-bisturi">
                  <span className="font-serif text-[1.4rem] font-light">{s.name}</span>
                  <span className="tnum text-[0.9rem] text-cafe">{formatDuration(s.duration_minutes)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
