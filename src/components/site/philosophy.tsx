import { Photo } from "@/components/site/photo";
import { Reveal } from "@/components/site/reveal";
import type { ContentMap } from "@/lib/content";

export function Philosophy({ content }: { content: ContentMap }) {
  return (
    <section data-section="Filosofia" className="wrap py-[var(--spacing-section)]">
      <div className="grid items-start gap-y-14 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-4 lg:row-span-2">
          <Photo slot="filosofia1" content={content} alt="Atendimento de estética" sizes="(min-width: 1024px) 30vw, 88vw" />
        </div>

        <Reveal className="lg:col-span-7 lg:col-start-6">
          <p className="t-h2 max-w-[26ch]">{content["philosophy.text"]}</p>
        </Reveal>

        <div className="ml-auto w-[58%] lg:col-span-3 lg:col-start-9 lg:mt-10 lg:w-full">
          <Photo slot="filosofia2" content={content} alt="Detalhe do atendimento" sizes="(min-width: 1024px) 22vw, 50vw" />
        </div>
      </div>
    </section>
  );
}
