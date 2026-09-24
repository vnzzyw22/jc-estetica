import type { Metadata } from "next";
import { AboutBlock } from "@/components/site/about-block";
import { Closing } from "@/components/site/closing";
import { getContent, getSettings } from "@/lib/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sobre a Jennifer",
  description: "Conheça Jennifer Camila: trajetória, abordagem de atendimento e o espaço onde os atendimentos acontecem.",
  alternates: { canonical: "/sobre" },
};

export default async function AboutPage() {
  const [settings, content] = await Promise.all([getSettings(), getContent()]);
  return (
    <>
      <div className="pt-4 lg:pt-8">
        <AboutBlock name={settings.business_name} content={content} full />
      </div>
      <Closing settings={settings} />
    </>
  );
}
