import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Procedures } from "@/components/site/procedures";
import { getServices } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Procedimentos de estética facial e corporal",
  description: "Procedimentos de estética facial e corporal com duração e valor à vista. Escolha e agende online.",
  alternates: { canonical: "/servicos" },
};

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <PageHeader title="Procedimentos" section="Procedimentos" lead="Escolha uma categoria. Duração e valor aparecem antes de você agendar." />
      <section className="wrap pb-[var(--spacing-section)]">
        <Procedures services={services} />
      </section>
    </>
  );
}
