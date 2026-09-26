import Link from "next/link";
import { deletePackageAction, savePackageAction } from "@/app/admin/(painel)/pacotes/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Notice } from "@/components/admin/finance/notice";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDuration, formatMoney } from "@/lib/format";

export const metadata = { title: "Pacotes" };

type Search = Promise<{ edit?: string; erro?: string; aviso?: string }>;

export default async function PackagesPage({ searchParams }: { searchParams: Search }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;

  const [packages, links, services] = await Promise.all([
    db.list("treatment_packages", { order: [["display_order", "asc"], ["name", "asc"]] }),
    db.list("package_services", { order: [["position", "asc"]] }),
    db.list("services", { order: [["display_order", "asc"]] }),
  ]);
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const byPackage = new Map<string, string[]>();
  for (const l of links) byPackage.set(l.package_id, [...(byPackage.get(l.package_id) ?? []), l.service_id]);

  const editing = sp.edit === "novo" ? "novo" : (packages.find((p) => p.id === sp.edit) ?? null);
  const p = editing && editing !== "novo" ? editing : null;
  const chosen = p ? (byPackage.get(p.id) ?? []) : [];
  // Marcados primeiro, na ordem do pacote; os demais, na ordem do catálogo.
  // Serviço já escolhido continua na lista mesmo se foi desativado depois (senão sairia do pacote sem ninguém ver).
  const ordered = [...chosen.map((id) => serviceById.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s)), ...services.filter((s) => s.active && !chosen.includes(s.id))];

  return (
    <>
      <PageTitle title="Pacotes de tratamento">
        <Link href="/admin/tratamentos" className="link-draw text-[0.9rem]">
          Ver tratamentos
        </Link>
        <Link href="/admin/pacotes?edit=novo" className="btn btn-sm">
          Novo pacote
        </Link>
      </PageTitle>
      <Notice erro={sp.erro} aviso={sp.aviso} />

      <p className="mb-8 max-w-[64ch] text-cafe">
        O catálogo de tratamentos que você propõe às clientes. Ao propor, o pacote é <strong className="font-medium text-espresso">copiado</strong> para a cliente: mudar o pacote depois não altera tratamentos já criados. Os serviços marcados, na ordem escolhida, se alternam nas sessões.
      </p>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-[1fr_minmax(0,32rem)]">
        <section aria-label="Lista de pacotes">
          {packages.length === 0 ? (
            <Empty>Nenhum pacote cadastrado. Crie o primeiro em “Novo pacote”.</Empty>
          ) : (
            <ul className="border-t border-linha">
              {packages.map((item) => {
                const names = (byPackage.get(item.id) ?? []).map((id) => serviceById.get(id)?.name).filter(Boolean);
                return (
                  <li key={item.id} className="border-b border-linha">
                    <Link href={`/admin/pacotes?edit=${item.id}`} className={`grid gap-x-4 gap-y-1 px-2 py-3.5 transition-colors hover:bg-seda/60 sm:grid-cols-[1fr_auto] ${p?.id === item.id ? "bg-seda" : ""}`}>
                      <span className="min-w-0">
                        <span className={`block font-medium ${item.active ? "" : "text-cafe/60 line-through"}`}>{item.name}</span>
                        <span className="t-small block">
                          {item.session_count} {item.session_count === 1 ? "sessão" : "sessões"}
                          {item.interval_days ? `, a cada ${item.interval_days} dias` : ""}
                          {item.active ? "" : " · inativo"}
                        </span>
                        <span className="t-small block truncate">{names.length ? names.join(", ") : "Sem serviços definidos"}</span>
                      </span>
                      <span className="tnum t-small sm:text-right">{item.price !== null ? formatMoney(item.price) : "sem valor"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {editing && (
          <section aria-labelledby="form-pacote" className="xl:sticky xl:top-8 xl:self-start">
            <h2 id="form-pacote" className="t-h3 mb-4">
              {p ? "Editar pacote" : "Novo pacote"}
            </h2>
            <AdminForm key={p?.id ?? "novo"} action={savePackageAction} submitLabel={p ? "Salvar" : "Criar pacote"} className="grid gap-4 sm:grid-cols-2">
              {p && <input type="hidden" name="id" value={p.id} />}
              <Field label="Nome" className="sm:col-span-2">
                <input name="name" defaultValue={p?.name} maxLength={120} required className="field" />
              </Field>
              <Field label="Objetivo" className="sm:col-span-2">
                <input name="goal" defaultValue={p?.goal ?? ""} maxLength={300} className="field" />
              </Field>
              <Field label="Sessões">
                <input name="session_count" type="number" min={1} max={200} defaultValue={p?.session_count ?? 8} required className="field tnum" />
              </Field>
              <Field label="Valor (R$)" hint="Vazio: sem valor definido.">
                <input name="price" inputMode="decimal" defaultValue={p?.price != null ? p.price.toFixed(2).replace(".", ",") : ""} className="field tnum" />
              </Field>
              <Field label="Intervalo entre sessões (dias)">
                <input name="interval_days" type="number" min={1} max={365} defaultValue={p?.interval_days ?? ""} className="field tnum" />
              </Field>
              <Field label="Validade (dias)" hint="Prazo para concluir, contado da proposta.">
                <input name="validity_days" type="number" min={1} max={1825} defaultValue={p?.validity_days ?? ""} className="field tnum" />
              </Field>
              <Field label="Frequência (texto livre)" className="sm:col-span-2">
                <input name="frequency_note" defaultValue={p?.frequency_note ?? ""} maxLength={200} className="field" />
              </Field>
              <Field label="Descrição" className="sm:col-span-2">
                <textarea name="description" defaultValue={p?.description ?? ""} rows={3} maxLength={1000} className="field" />
              </Field>

              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-[0.9rem] font-medium">Serviços do pacote</legend>
                <p className="t-small mb-3">Marque os serviços e defina a ordem (1, 2, 3…). Com mais de um, eles se alternam nas sessões.</p>
                {ordered.length === 0 ? (
                  <p className="t-small">Cadastre serviços ativos antes.</p>
                ) : (
                  <ul className="border-t border-linha">
                    {ordered.map((s, i) => (
                      <li key={s.id} className="grid grid-cols-[1fr_4.5rem] items-center gap-x-4 border-b border-linha py-2">
                        <label className="flex min-h-11 items-center gap-3">
                          <input type="checkbox" name="service_ids" value={s.id} defaultChecked={chosen.includes(s.id)} className="h-5 w-5 accent-[var(--color-bisturi)]" />
                          <span>
                            {s.name} <span className="tnum t-small">{formatDuration(s.duration_minutes)}{s.active ? "" : ", inativo"}</span>
                          </span>
                        </label>
                        <input name={`pos_${s.id}`} type="number" min={1} max={99} defaultValue={chosen.includes(s.id) ? chosen.indexOf(s.id) + 1 : i + 1} aria-label={`Ordem de ${s.name}`} className="field tnum" />
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>

              <Field label="Observações" className="sm:col-span-2">
                <textarea name="notes" defaultValue={p?.notes ?? ""} rows={2} maxLength={2000} className="field" />
              </Field>
              <Field label="Ordem de exibição">
                <input name="display_order" type="number" defaultValue={p?.display_order ?? packages.length + 1} className="field tnum" />
              </Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-5 w-5 accent-[var(--color-bisturi)]" />
                Ativo (pode ser proposto)
              </label>
            </AdminForm>

            {p && (
              <form action={deletePackageAction} className="mt-8">
                <input type="hidden" name="id" value={p.id} />
                <ConfirmButton confirm="Excluir este pacote? Os tratamentos já criados a partir dele não mudam." className="link-draw text-[0.9rem] text-alerta">
                  Excluir pacote
                </ConfirmButton>
              </form>
            )}
          </section>
        )}
      </div>
    </>
  );
}
