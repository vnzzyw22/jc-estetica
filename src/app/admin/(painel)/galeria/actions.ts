"use server";

import { bool, guarded, imageFile, num, optStr, str, type ActionState } from "@/lib/admin-util";
import { DbError } from "@/lib/data/db";
import type { GalleryCategory } from "@/lib/types";

const PATHS = ["/", "/galeria", "/admin/galeria"];
const CATEGORIES: GalleryCategory[] = ["facial", "corporal", "espaco", "profissional"];

export async function uploadGalleryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const category = str(fd, "category") as GalleryCategory;
  if (!CATEGORIES.includes(category)) return { error: "Categoria inválida." };

  return guarded(async (db) => {
    const file = imageFile(fd, "image");
    if (!file) throw new DbError("upload_failed");
    const url = await db.uploadMedia(file, "gallery");
    await db.insert("gallery", {
      image_url: url,
      title: optStr(fd, "title"),
      category,
      display_order: Math.round(num(fd, "display_order", 0)),
      featured: bool(fd, "featured"),
      active: bool(fd, "active"),
    });
    return "Foto adicionada.";
  }, PATHS);
}

export async function updateGalleryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const category = str(fd, "category") as GalleryCategory;
  if (!CATEGORIES.includes(category)) return { error: "Categoria inválida." };
  return guarded(async (db) => {
    await db.update("gallery", str(fd, "id"), {
      title: optStr(fd, "title"),
      category,
      display_order: Math.round(num(fd, "display_order", 0)),
      featured: bool(fd, "featured"),
      active: bool(fd, "active"),
    });
  }, PATHS);
}

export async function deleteGalleryAction(fd: FormData): Promise<void> {
  await guarded((db) => db.remove("gallery", str(fd, "id")), PATHS);
}
