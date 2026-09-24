import Image from "next/image";
import { deleteGalleryAction, updateGalleryAction, uploadGalleryAction } from "@/app/admin/(painel)/galeria/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { CATEGORY_LABEL } from "@/lib/format";

export const metadata = { title: "Galeria" };

const CATEGORIES = ["facial", "corporal", "espaco", "profissional"] as const;

function CategorySelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select name="category" defaultValue={defaultValue} className="field">
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {CATEGORY_LABEL[c]}
        </option>
      ))}
    </select>
  );
}

export default async function GalleryAdminPage() {
  const { db } = await requireAdmin();
  const items = await db.list("gallery", { order: [["display_order", "asc"]] });

  return (
    <>
      <PageTitle title="Galeria" />

      <section aria-labelledby="enviar" className="mb-14 max-w-2xl">
        <h2 id="enviar" className="t-h3 mb-4">
          Adicionar foto
        </h2>
        <AdminForm action={uploadGalleryAction} submitLabel="Enviar foto" resetOnSuccess className="grid gap-4 sm:grid-cols-2">
          <Field label="Imagem (JPG, PNG ou WebP, até 5 MB)" className="sm:col-span-2">
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className="text-[0.9rem]" />
          </Field>
          <Field label="Título / legenda">
            <input name="title" className="field" />
          </Field>
          <Field label="Categoria">
            <CategorySelect defaultValue="facial" />
          </Field>
          <Field label="Ordem">
            <input name="display_order" type="number" defaultValue={items.length + 1} className="field" />
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="featured" className="h-5 w-5 accent-[var(--color-bisturi)]" /> Destaque na home
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-[var(--color-bisturi)]" /> Ativa
            </label>
          </div>
        </AdminForm>
      </section>

      <h2 className="t-h3 mb-4">Fotos ({items.length})</h2>
      {items.length === 0 ? (
        <Empty>Nenhuma foto. As molduras da home e da galeria aparecem como espaços reservados até você enviar as primeiras.</Empty>
      ) : (
        <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((g) => (
            <li key={g.id} className="grid grid-cols-[6rem_1fr] gap-4 border-t border-linha pt-4">
              <div className="relative aspect-[3/4] overflow-hidden bg-nude">
                <Image src={g.image_url} alt={g.title ?? "Foto da galeria"} fill sizes="96px" className="object-cover" />
              </div>
              <div>
                <AdminForm action={updateGalleryAction} className="grid gap-3">
                  <input type="hidden" name="id" value={g.id} />
                  <Field label="Título">
                    <input name="title" defaultValue={g.title ?? ""} className="field" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Categoria">
                      <CategorySelect defaultValue={g.category} />
                    </Field>
                    <Field label="Ordem">
                      <input name="display_order" type="number" defaultValue={g.display_order} className="field" />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <label className="flex min-h-9 items-center gap-2 text-[0.9rem]">
                      <input type="checkbox" name="featured" defaultChecked={g.featured} className="h-5 w-5 accent-[var(--color-bisturi)]" /> Destaque
                    </label>
                    <label className="flex min-h-9 items-center gap-2 text-[0.9rem]">
                      <input type="checkbox" name="active" defaultChecked={g.active} className="h-5 w-5 accent-[var(--color-bisturi)]" /> Ativa
                    </label>
                  </div>
                </AdminForm>
                <form action={deleteGalleryAction} className="mt-2">
                  <input type="hidden" name="id" value={g.id} />
                  <ConfirmButton confirm="Excluir esta foto da galeria?" className="link-draw text-[0.9rem] text-alerta">
                    Excluir
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
