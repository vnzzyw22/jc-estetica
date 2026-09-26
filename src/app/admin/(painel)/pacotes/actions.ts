"use server";

import { redirect } from "next/navigation";
import { bool, guarded, num, str, type ActionState } from "@/lib/admin-util";
import { parseMoney } from "@/lib/finance";
import { withParam } from "@/lib/flash";
import { validatePackage } from "@/lib/treatment";

const PATHS = ["/admin/pacotes", "/admin/tratamentos", "/admin/clientes"];

/**
 * Serviços marcados, na ordem que a Jennifer definiu (campo "ordem" de cada um; empate: ordem da lista).
 * A ordem define o rodízio dos serviços nas sessões de um tratamento.
 */
function chosenServices(fd: FormData): string[] {
  const ids = fd.getAll("service_ids").map(String);
  return [...new Set(ids)]
    .map((id, i) => ({ id, pos: Number(str(fd, `pos_${id}`)) || 0, i }))
    .sort((a, b) => a.pos - b.pos || a.i - b.i)
    .map((x) => x.id);
}

export async function savePackageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const priceRaw = str(fd, "price");
  const parsed = validatePackage({
    name: str(fd, "name"),
    description: str(fd, "description"),
    goal: str(fd, "goal"),
    session_count: str(fd, "session_count"),
    interval_days: str(fd, "interval_days"),
    frequency_note: str(fd, "frequency_note"),
    price: priceRaw ? (parseMoney(priceRaw) ?? Number.NaN) : null,
    validity_days: str(fd, "validity_days"),
    notes: str(fd, "notes"),
  });
  if (!parsed.ok) return { error: Object.values(parsed.errors).join(" ") };

  const id = str(fd, "id");
  const row = { ...parsed.value, active: bool(fd, "active"), display_order: Math.round(num(fd, "display_order", 0)) };

  return guarded(async (db) => {
    const saved = id ? await db.update("treatment_packages", id, row) : await db.insert("treatment_packages", row);
    await db.rpc("save_package_services", { p_package_id: saved.id, p_service_ids: chosenServices(fd) });
    return id ? "Pacote salvo." : "Pacote criado.";
  }, PATHS);
}

/** Tratamentos já criados guardam uma cópia do pacote: apagar o pacote não altera nenhum deles. */
export async function deletePackageAction(fd: FormData): Promise<void> {
  const res = await guarded((db) => db.remove("treatment_packages", str(fd, "id")), PATHS);
  redirect(res?.error ? withParam("/admin/pacotes", "erro", res.error) : withParam("/admin/pacotes", "aviso", "Pacote excluído."));
}
