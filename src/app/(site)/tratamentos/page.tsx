import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Procedures } from "@/components/site/procedures";
import { getServices } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Tratamentos de estética facial e corporal",
  description: "Estética facial e olhar, corporal e modelagem, terapias integradas e bem-estar. Conheça os tratamentos da Jennifer Camila.",
  alternates: { canonical: "/tratamentos" },
};

export default async function TreatmentsPage() {
  const services = await getServices();
  return (
    <>
      <PageHeader title="Tratamentos" section="Tratamentos" lead="Três frentes de cuidado. Se ficar em dúvida por onde começar, faça a triagem." />
      <section className="wrap pb-[var(--spacing-section)]">
        <Procedures services={services} />
      </section>
    </>
  );
}
