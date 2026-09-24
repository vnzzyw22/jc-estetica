"use server";

import { bool, guarded, imageFile, str, type ActionState } from "@/lib/admin-util";
import { CONTENT_FIELDS } from "@/lib/content";

export async function saveContentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async (db) => {
    for (const field of CONTENT_FIELDS) {
      if (field.kind === "image") {
        const file = imageFile(fd, field.key);
        if (file) await db.upsert("site_content", { key: field.key, value: await db.uploadMedia(file, "site") });
        else if (bool(fd, `remove:${field.key}`)) await db.upsert("site_content", { key: field.key, value: "" });
        continue;
      }
      if (fd.has(field.key)) await db.upsert("site_content", { key: field.key, value: str(fd, field.key) });
    }
    return "Conteúdo salvo. O site é atualizado em instantes.";
  }, ["/", "/sobre", "/admin/conteudo"]);
}
