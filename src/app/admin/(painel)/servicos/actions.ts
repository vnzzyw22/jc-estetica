"use server";

import { redirect } from "next/navigation";
import { bool, guarded, imageFile, num, optNum, optStr, str, type ActionState } from "@/lib/admin-util";
import { slugify } from "@/lib/format";
import type { ServiceCategory } from "@/lib/types";

const PATHS = ["/", "/tratamentos", "/agendamento", "/admin/servicos"];
const CATEGORIES: ServiceCategory[] = ["facial_olhar", "corporal_modelagem", "terapias_bem_estar"];

export async function saveServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Informe o nome do procedimento." };
  const category = str(fd, "category") as ServiceCategory;
  if (!CATEGORIES.includes(category)) return { error: "Categoria inválida." };
  const duration = Math.round(num(fd, "duration_minutes", 0));
  if (duration <= 0) return { error: "A duração precisa ser maior que zero." };
  const price = optNum(fd, "price");
  if (price !== null && price < 0) return { error: "O valor não pode ser negativo." };
  const id = str(fd, "id");

  return guarded(async (db) => {
    let imageUrl: string | null | undefined;
    const file = imageFile(fd, "image");
    if (file) imageUrl = await db.uploadMedia(file, "services");
    else if (bool(fd, "remove_image")) imageUrl = null;

    const row = {
      name,
      slug: slugify(str(fd, "slug") || name) || crypto.randomUUID().slice(0, 8),
      category,
      description: optStr(fd, "description"),
      indication: optStr(fd, "indication"),
      duration_minutes: duration,
      duration_confirmed: bool(fd, "duration_confirmed"),
      price,
      active: bool(fd, "active"),
      display_order: Math.round(num(fd, "display_order", 0)),
      ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
    };
    if (id) await db.update("services", id, row);
    else await db.insert("services", { ...row, image_url: imageUrl ?? null });
    return id ? "Serviço atualizado." : "Serviço criado.";
  }, PATHS);
}

export async function deleteServiceAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const result = await guarded((db) => db.remove("services", id), PATHS);
  if (result?.error) redirect(`/admin/servicos?edit=${id}&erro=vinculado`);
  redirect("/admin/servicos");
}
