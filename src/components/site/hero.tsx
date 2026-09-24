import Link from "next/link";
import { NextSlot } from "@/components/site/next-slot";
import { ParallaxFrame } from "@/components/site/parallax-frame";
import { Photo } from "@/components/site/photo";
import { LOCALITY_PLACEHOLDER } from "@/lib/site";
import type { ContentMap } from "@/lib/content";
import type { Settings } from "@/lib/types";

/** Nome da marca em duas linhas: primeiro nome / resto. */
function splitName(full: string): [string, string] {
  const [first, ...rest] = full.trim().split(/\s+/);
  return [first, rest.join(" ")];
}

export function Hero({ settings, content }: { settings: Settings; content: ContentMap }) {
  const [first, rest] = splitName(settings.business_name);

  return (
    <section data-section="Início" className="wrap grid gap-x-6 pb-16 pt-6 lg:grid-cols-12 lg:pb-28 lg:pt-10">
      <h1 className="t-name relative z-10 lg:col-span-9 lg:col-start-1 lg:row-start-1">
        <span className="name-mask">
          <span className="name-line" style={{ ["--d" as string]: "60ms" }}>
            {first}
          </span>
        </span>
        {rest && (
          <span className="name-mask pl-10 lg:pl-[34%]">
            <span className="name-line" style={{ ["--d" as string]: "200ms" }}>
              {rest}
            </span>
          </span>
        )}
      </h1>

      <div className="relative mt-8 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:-mr-[var(--spacing-gutter)] lg:mt-0">
        <ParallaxFrame>
          <Photo slot="hero" ratioMobile="1 / 1" content={content} alt={`${settings.business_name}, ${settings.business_tagline}`} sizes="(min-width: 1024px) 42vw, 100vw" priority />
        </ParallaxFrame>
      </div>

      <div className="mt-10 lg:col-span-6 lg:col-start-1 lg:row-start-2 lg:mt-20 lg:self-start">
        <p className="t-lead max-w-[22ch]">{content["hero.tagline"]}</p>
        <p className="mt-5 text-[0.95rem] text-cafe">
          {settings.business_tagline}, {settings.city || LOCALITY_PLACEHOLDER}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href="/agendamento" className="btn">
            Agendar horário
          </Link>
          <Link href="/servicos" className="link-draw font-medium">
            Ver procedimentos
          </Link>
        </div>

        <NextSlot className="mt-8 text-[0.95rem] text-bisturi" />
      </div>
    </section>
  );
}
