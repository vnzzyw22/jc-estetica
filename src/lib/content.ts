// Campos de texto/imagem editáveis pelo painel (/admin/conteudo), guardados em `site_content`.
// O `fallback` é o que o site mostra enquanto o campo não foi preenchido — sempre um
// placeholder explícito quando o dado é factual (nunca conteúdo inventado).

export type ContentKind = "text" | "longtext" | "image";

export interface ContentField {
  key: string;
  label: string;
  kind: ContentKind;
  group: "Início" | "Profissional" | "Espaço" | "Imagens";
  hint?: string;
  fallback: string;
}

export const CONTENT_FIELDS: ContentField[] = [
  { key: "hero.tagline", label: "Frase do início", kind: "text", group: "Início", hint: "Aparece ao lado do nome, no topo da página.", fallback: "Cuidado com precisão, feito por gente." },
  { key: "philosophy.text", label: "Filosofia de atendimento", kind: "longtext", group: "Início", hint: "Texto grande logo abaixo do início. O texto inicial é um rascunho: troque pelas palavras da Jennifer.", fallback: "[Filosofia de atendimento da Jennifer — informar]" },
  { key: "about.role", label: "Formação e especialização", kind: "longtext", group: "Profissional", hint: "Só informações reais: formação, cursos, especializações.", fallback: "[Formação e especialização da Jennifer — informar]" },
  { key: "about.text", label: "Trajetória", kind: "longtext", group: "Profissional", fallback: "[Trajetória real da Jennifer — a ser informada]" },
  { key: "about.approach", label: "Abordagem de atendimento", kind: "longtext", group: "Profissional", fallback: "[Abordagem de atendimento — a ser informada]" },
  { key: "about.experience", label: "Experiência", kind: "longtext", group: "Profissional", fallback: "[Experiência profissional — a ser informada]" },
  { key: "space.text", label: "Descrição do espaço", kind: "longtext", group: "Espaço", fallback: "[Descrição real do espaço de atendimento]" },
  { key: "img.hero", label: "Foto do início", kind: "image", group: "Imagens", hint: "Retrato vertical 4:5. Ideal: 1600×2000 px.", fallback: "" },
  { key: "img.filosofia-1", label: "Foto da filosofia (grande)", kind: "image", group: "Imagens", hint: "Vertical 3:4.", fallback: "" },
  { key: "img.filosofia-2", label: "Foto da filosofia (detalhe)", kind: "image", group: "Imagens", hint: "Quadrada 1:1.", fallback: "" },
  { key: "img.sobre", label: "Retrato profissional", kind: "image", group: "Imagens", hint: "Vertical 4:5.", fallback: "" },
  { key: "img.espaco", label: "Foto do espaço", kind: "image", group: "Imagens", hint: "Horizontal 5:4.", fallback: "" },
];

export const IMAGE_SLOTS = {
  hero: { key: "img.hero", caption: "[Foto profissional da Jennifer]", ratio: "4 / 5" },
  filosofia1: { key: "img.filosofia-1", caption: "[Foto de atendimento]", ratio: "3 / 4" },
  filosofia2: { key: "img.filosofia-2", caption: "[Foto de detalhe]", ratio: "1 / 1" },
  sobre: { key: "img.sobre", caption: "[Retrato profissional da Jennifer]", ratio: "4 / 5" },
  espaco: { key: "img.espaco", caption: "[Foto do espaço]", ratio: "5 / 4" },
} as const;

export type ContentMap = Record<string, string>;

export function contentWithFallbacks(rows: Array<{ key: string; value: string }>): ContentMap {
  const map: ContentMap = Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.fallback]));
  for (const row of rows) if (row.value.trim()) map[row.key] = row.value;
  return map;
}
