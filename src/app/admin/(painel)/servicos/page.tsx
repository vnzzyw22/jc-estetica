import Image from "next/image";
import Link from "next/link";
import { deleteServiceAction, saveServiceAction } from "@/app/admin/(painel)/servicos/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { CATEGORY_LABEL, formatDuration, formatPrice } from "@/lib/format";

export const metadata = { title: "Serviços" };

export default async function ServicesAdminPage({ searchParams }: { searchParams: Promise<{ edit?: string; erro?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const services = await db.list("services", { order: [["display_order", "asc"]] });
  const editing = sp.edit === "novo" ? "novo" : services.find((s) => s.id === sp.edit) ?? null;
  const s = editing && editing !== "novo" ? editing : null;

  return (
    <>
      <PageTitle title="Serviços">
        <Link href="/admin/servicos?edit=novo" className="btn btn-sm">
          Novo serviço
        </Link>
      </PageTitle>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-[1fr_minmax(0,28rem)]">
        <section aria-label="Lista de serviços">
          {services.length === 0 ? (
            <Empty>Nenhum serviço cadastrado.</Empty>
          ) : (
            <ul className="border-t border-linha">
              {services.map((item) => (
                <li key={item.id} className="border-b border-linha">
                  <Link href={`/admin/servicos?edit=${item.id}`} className={`grid gap-x-4 gap-y-1 px-2 py-3.5 transition-colors hover:bg-seda/60 sm:grid-cols-[1fr_auto] ${s?.id === item.id ? "bg-seda" : ""}`}>
                    <span>
                      <span className={`block font-medium ${item.active ? "" : "text-cafe/60 line-through"}`}>{item.name}</span>
                      <span className="t-small">
                        {CATEGORY_LABEL[item.category]} · ordem {item.display_order}
                        {item.active ? "" : " · inativo"}
                      </span>
                    </span>
                    <span className="tnum t-small sm:text-right">
                      {formatDuration(item.duration_minutes)} · {formatPrice(item.price)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {editing && (
          <section aria-labelledby="form-servico" className="xl:sticky xl:top-8 xl:self-start">
            <h2 id="form-servico" className="t-h3 mb-4">
              {s ? "Editar serviço" : "Novo serviço"}
            </h2>
            {sp.erro === "vinculado" && (
              <p role="alert" className="mb-4 border-l-2 border-alerta bg-alerta/5 px-3 py-2 text-[0.9rem] text-alerta">
                Este serviço tem agendamentos e não pode ser excluído. Desmarque “Ativo” para tirá-lo do site.
              </p>
            )}
            <AdminForm key={s?.id ?? "novo"} action={saveServiceAction} submitLabel={s ? "Salvar" : "Criar serviço"} className="grid gap-4 sm:grid-cols-2">
              {s && <input type="hidden" name="id" value={s.id} />}
              <Field label="Nome" className="sm:col-span-2">
                <input name="name" defaultValue={s?.name} className="field" required />
              </Field>
              <Field label="Categoria">
                <select name="category" defaultValue={s?.category ?? "facial_olhar"} className="field">
                  {(["facial_olhar", "corporal_modelagem", "terapias_bem_estar"] as const).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ordem de exibição">
                <input name="display_order" type="number" defaultValue={s?.display_order ?? services.length + 1} className="field" />
              </Field>
              <Field label="Duração (minutos)">
                <input name="duration_minutes" type="number" min={5} step={5} defaultValue={s?.duration_minutes ?? 60} className="field" required />
              </Field>
              <Field label="Valor (R$)" hint="Vazio mostra “sob avaliação”.">
                <input name="price" inputMode="decimal" defaultValue={s?.price ?? ""} className="field" />
              </Field>
              <Field label="Descrição" className="sm:col-span-2">
                <textarea name="description" defaultValue={s?.description ?? ""} rows={3} className="field" />
              </Field>
              <Field label="Indicação" className="sm:col-span-2">
                <input name="indication" defaultValue={s?.indication ?? ""} className="field" />
              </Field>
              <Field label="Endereço da página (slug)" hint="Vazio gera a partir do nome." className="sm:col-span-2">
                <input name="slug" defaultValue={s?.slug} className="field" />
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-[0.9rem] font-medium">Imagem</p>
                {s?.image_url && (
                  <div className="relative mb-3 h-28 w-24 overflow-hidden">
                    <Image src={s.image_url} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                )}
                <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="text-[0.9rem]" aria-label="Enviar imagem" />
                {s?.image_url && (
                  <label className="mt-2 flex items-center gap-2 text-[0.9rem]">
                    <input type="checkbox" name="remove_image" /> Remover imagem atual
                  </label>
                )}
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="h-5 w-5 accent-[var(--color-bisturi)]" />
                Ativo (aparece no site e no agendamento)
              </label>
            </AdminForm>

            {s && (
              <form action={deleteServiceAction} className="mt-8">
                <input type="hidden" name="id" value={s.id} />
                <ConfirmButton confirm="Excluir este serviço?" className="link-draw text-[0.9rem] text-alerta">
                  Excluir serviço
                </ConfirmButton>
              </form>
            )}
          </section>
        )}
      </div>
    </>
  );
}
