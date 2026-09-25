import { cache } from "react";
import { getPublicDb } from "@/lib/data";
import { contentWithFallbacks, type ContentMap } from "@/lib/content";
import type { AvailabilityRow, ConsentTerm, FaqItem, GalleryItem, Service, Settings } from "@/lib/types";

// Leituras públicas (RLS anônima). `cache` deduplica dentro da mesma requisição.

export const getSettings = cache(async (): Promise<Settings> => {
  const [row] = await getPublicDb().list("settings", { limit: 1 });
  return row;
});

export const getAvailability = cache(async (): Promise<AvailabilityRow[]> =>
  getPublicDb().list("availability", { order: [["weekday", "asc"]] }),
);

export const getServices = cache(async (): Promise<Service[]> =>
  getPublicDb().list("services", { eq: { active: true }, order: [["display_order", "asc"]] }),
);

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const [row] = await getPublicDb().list("services", { eq: { slug, active: true }, limit: 1 });
  return row ?? null;
}

export const getGallery = cache(async (): Promise<GalleryItem[]> =>
  getPublicDb().list("gallery", { eq: { active: true }, order: [["display_order", "asc"]] }),
);

export const getFaq = cache(async (): Promise<FaqItem[]> =>
  getPublicDb().list("faq", { eq: { active: true }, order: [["display_order", "asc"]] }),
);

/** Termo de consentimento da triagem em vigor (o público só enxerga o ATIVO, por RLS). */
export const getActiveScreeningTerm = cache(async (): Promise<ConsentTerm | null> => {
  const [term] = await getPublicDb().list("consent_terms", { eq: { kind: "screening", active: true }, limit: 1 });
  return term ?? null;
});

export const getContent = cache(async (): Promise<ContentMap> =>
  contentWithFallbacks(await getPublicDb().list("site_content")),
);
