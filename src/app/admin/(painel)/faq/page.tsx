import { deleteFaqAction, saveFaqAction } from "@/app/admin/(painel)/faq/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "FAQ" };

export default async function FaqAdminPage() {
  const { db } = await requireAdmin();
  const items = await db.list("faq", { order: [["display_order", "asc"]] });

  return (
    <>
      <PageTitle title="Perguntas frequentes" />

      <section aria-labelledby="nova" className="mb-14 max-w-2xl">
        <h2 id="nova" className="t-h3 mb-4">
          Nova pergunta
        </h2>
        <AdminForm action={saveFaqAction} submitLabel="Adicionar" resetOnSuccess className="grid gap-4">
          <Field label="Pergunta">
            <input name="question" className="field" required />
          </Field>
          <Field label="Resposta">
            <textarea name="answer" rows={3} className="field" required />
          </Field>
          <div className="grid grid-cols-2 items-end gap-4">
            <Field label="Ordem">
              <input name="display_order" type="number" defaultValue={items.length + 1} className="field" />
            </Field>
            <label className="flex min-h-12 items-center gap-2">
              <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-[var(--color-bisturi)]" /> Visível no site
            </label>
          </div>
        </AdminForm>
      </section>

      <h2 className="t-h3 mb-4">Perguntas ({items.length})</h2>
      <ul className="max-w-2xl border-t border-linha">
        {items.map((q) => (
          <li key={q.id} className="border-b border-linha py-6">
            <AdminForm action={saveFaqAction} className="grid gap-4">
              <input type="hidden" name="id" value={q.id} />
              <Field label="Pergunta">
                <input name="question" defaultValue={q.question} className="field" required />
              </Field>
              <Field label="Resposta">
                <textarea name="answer" defaultValue={q.answer} rows={3} className="field" required />
              </Field>
              <div className="grid grid-cols-2 items-end gap-4">
                <Field label="Ordem">
                  <input name="display_order" type="number" defaultValue={q.display_order} className="field" />
                </Field>
                <label className="flex min-h-12 items-center gap-2">
                  <input type="checkbox" name="active" defaultChecked={q.active} className="h-5 w-5 accent-[var(--color-bisturi)]" /> Visível no site
                </label>
              </div>
            </AdminForm>
            <form action={deleteFaqAction} className="mt-2">
              <input type="hidden" name="id" value={q.id} />
              <ConfirmButton confirm="Excluir esta pergunta?" className="link-draw text-[0.9rem] text-alerta">
                Excluir
              </ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
