import Image from "next/image";
import { IMAGE_SLOTS } from "@/lib/content";

type SlotName = keyof typeof IMAGE_SLOTS;

interface PhotoProps {
  slot: SlotName;
  /** Mapa de conteúdo (site_content) já com fallbacks. */
  content: Record<string, string>;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Sobrescreve a proporção padrão do slot. */
  ratio?: string;
  ratioMobile?: string;
}

/** Marcas de registro nos cantos — o dispositivo gráfico da marca (cortes de prova). */
function Marks() {
  const corner = "absolute h-3 w-3 text-porcelana/80 mix-blend-difference";
  return (
    <span aria-hidden className="pointer-events-none absolute inset-3">
      {[
        "left-0 top-0",
        "right-0 top-0",
        "bottom-0 left-0",
        "bottom-0 right-0",
      ].map((pos) => (
        <svg key={pos} viewBox="0 0 12 12" className={`${corner} ${pos}`} fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M6 0v12M0 6h12" />
        </svg>
      ))}
    </span>
  );
}

interface ImageFrameProps {
  url?: string | null;
  caption: string;
  alt: string;
  ratio: string;
  /** Proporção abaixo de 1024px (o padrão é a mesma do desktop). */
  ratioMobile?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/** Moldura de imagem com marcas de registro. Sem URL, mostra a legenda do que deve entrar (placeholder explícito). */
export function ImageFrame({ url, caption, alt, ratio, ratioMobile, sizes, priority, className = "" }: ImageFrameProps) {
  return (
    <div className={`photo-slot aspect-(--rm) lg:aspect-(--r) ${className}`} style={{ ["--r" as string]: ratio, ["--rm" as string]: ratioMobile ?? ratio }}>
      <div data-media className="absolute inset-0">
        {url ? (
          <Image src={url} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
        ) : (
          <span data-photo-caption role="img" aria-label={`Espaço reservado: ${caption}`}>
            {caption}
          </span>
        )}
      </div>
      <Marks />
    </div>
  );
}

/** Slot nomeado de fotografia, alimentado pelo painel (site_content). */
export function Photo({ slot, content, alt, sizes, priority, className, ratio, ratioMobile }: PhotoProps) {
  const def = IMAGE_SLOTS[slot];
  return <ImageFrame url={content[def.key]} caption={def.caption} alt={alt} ratio={ratio ?? def.ratio} ratioMobile={ratioMobile} sizes={sizes} priority={priority} className={className} />;
}
