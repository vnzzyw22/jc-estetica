export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Localidade ainda não informada pelo cliente: o site mostra o placeholder, nunca inventa. */
export const LOCALITY_PLACEHOLDER = "[Localidade]";

export const NAV_LINKS = [
  { href: "/tratamentos", label: "Tratamentos" },
  { href: "/sobre", label: "Sobre" },
  { href: "/galeria", label: "Galeria" },
  { href: "/faq", label: "Perguntas" },
  { href: "/contato", label: "Contato" },
] as const;
