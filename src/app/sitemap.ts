import type { MetadataRoute } from "next";
import { getServices } from "@/lib/queries";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const services = await getServices().catch(() => []);
  const fixed = ["", "/servicos", "/agendamento", "/sobre", "/galeria", "/faq", "/contato"];
  return [
    ...fixed.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "monthly" as const, priority: path === "" ? 1 : 0.7 })),
    ...services.map((s) => ({ url: `${SITE_URL}/servicos/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
