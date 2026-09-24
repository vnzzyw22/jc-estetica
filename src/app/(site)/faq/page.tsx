import type { Metadata } from "next";
import { FaqList } from "@/components/site/faq-list";
import { PageHeader } from "@/components/site/page-header";
import { getFaq } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Perguntas frequentes",
  description: "Dúvidas sobre agendamento, duração, preparação, pagamento e cancelamento dos atendimentos.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const faq = await getFaq();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    // Respostas ainda em placeholder não vão para os dados estruturados.
    mainEntity: faq
      .filter((f) => !f.answer.trim().startsWith("["))
      .map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };

  return (
    <>
      <PageHeader title="Perguntas frequentes" section="Perguntas" lead="Não achou o que procura? Chame no WhatsApp." />
      <section className="wrap pb-[var(--spacing-section)]">
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-6">
          <div className="lg:col-span-8 lg:col-start-3">
            <FaqList items={faq} level={2} />
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
