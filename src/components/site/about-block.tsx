import Link from "next/link";
import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import type { ContentMap } from "@/lib/content";

interface AboutBlockProps {
  name: string;
  content: ContentMap;
  /** Na home mostra só o essencial e um link; na página /sobre mostra tudo. */
  full?: boolean;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-linha py-5 md:grid-cols-[10rem_1fr] md:gap-6">
      <dt className="t-small">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function AboutBlock({ name, content, full = false }: AboutBlockProps) {
  // Na página /sobre este é o título da página (h1); na home é uma seção (h2).
  const Title = full ? "h1" : "h2";
  return (
    <section data-section="Profissional" className="wrap py-[var(--spacing-section)]">
      <div className="grid items-start gap-y-12 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-5">
          <Photo slot="sobre" content={content} alt={`Retrato de ${name}`} sizes="(min-width: 1024px) 40vw, 100vw" />
        </div>

        <div className="lg:col-span-6 lg:col-start-7 lg:pt-16">
          <Reveal>
            <Title className="t-h1">{name}</Title>
            <p className="t-lead mt-6 max-w-[34ch] text-cafe">{content["about.role"]}</p>
          </Reveal>

          <dl className="mt-12">
            <Fact label="Trajetória">{content["about.text"]}</Fact>
            <Fact label="Abordagem">{content["about.approach"]}</Fact>
            <Fact label="Experiência">{content["about.experience"]}</Fact>
          </dl>

          {!full && (
            <Link href="/sobre" className="link-draw mt-10 font-medium">
              Conhecer a Jennifer
            </Link>
          )}
        </div>
      </div>

      {full && (
        <div className="mt-20 grid gap-y-8 lg:mt-28 lg:grid-cols-12 lg:gap-x-6">
          <div className="lg:col-span-6 lg:col-start-2 lg:order-2">
            <Photo slot="espaco" content={content} alt="Espaço de atendimento" sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
          <div className="lg:order-1 lg:col-span-4 lg:self-end">
            <h2 className="t-h3">O espaço</h2>
            <p className="mt-3 max-w-[44ch] text-cafe">{content["space.text"]}</p>
          </div>
        </div>
      )}
    </section>
  );
}
