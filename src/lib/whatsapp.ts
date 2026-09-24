import { digitsOnly } from "@/lib/format";

/** wa.me exige DDI. Sem DDI (10–11 dígitos) assume Brasil (55). */
export function whatsappLink(number: string | null | undefined, message?: string): string | null {
  if (!number) return null;
  let d = digitsOnly(number);
  if (d.length < 10) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
