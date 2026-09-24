import type { Metadata } from "next";
import { GalleryBrowser } from "@/components/site/gallery-browser";
import { PageHeader } from "@/components/site/page-header";
import { getGallery } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Galeria",
  description: "Fotografias de atendimentos, resultados e do espaço de Jennifer Camila.",
  alternates: { canonical: "/galeria" },
};

export default async function GalleryPage() {
  const items = await getGallery();
  return (
    <>
      <PageHeader title="Galeria" section="Galeria" lead="Fotografias reais de atendimentos e do espaço." />
      <section className="wrap pb-[var(--spacing-section)]">
        <GalleryBrowser items={items} />
      </section>
    </>
  );
}
