import { activateTermAction, saveTermAction } from "@/app/admin/(painel)/consentimento/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { dateTimeLabel } from "@/lib/date";

export const metadata = { title: "Consentimento" };

export default async function ConsentPage() {
  const { db } = await requireAdmin();
  const terms = await db.list("consent_terms", { eq: { kind: "screening" }, order: [["created_at", "desc"]] });
  const active = terms.find((t) => t.active);

  return (
    <>
      <PageTitle title="Consentimento da triagem" />

      <p className="mb-6 max-w-[64ch] text-cafe">
        A triagem coleta informações pessoais. Antes de receber dados reais, cole aqui o <strong className="font-medium text-espresso">texto oficial</strong> do termo de consentimento. O sistema não escreve texto jurídico.
      </p>

      <p role="status" className={`mb-10 max-w-[64ch] border-l-2 px-4 py-3 text-[0.95rem] ${active ? "border-bisturi bg-bisturi/5" : "border-rose bg-rose/10"}`}>
        {active
          ? `Termo em vigor: versão ${active.version}, publicado em ${active.published_at ? dateTimeLabel(active.published_at) : "—"}.`
          : "Nenhum termo em vigor. Em produção, a triagem NÃO recebe envios enquanto não houver um termo publicado."}
      </p>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
        <section aria-labelledby="novo-termo">
          <h2 id="novo-termo" className="t-h3 mb-4">
            Novo texto
          </h2>
          <AdminForm action={saveTermAction} submitLabel="Salvar" resetOnSuccess className="grid gap-4">
            <Field label="Versão" hint="Identifica esta redação (ex.: 2026-10). Cada envio guarda a versão aceita.">
              <input name="version" className="field" maxLength={40} required />
            </Field>
            <Field label="Texto do termo">
              <textarea name="body" rows={12} className="field" required />
            </Field>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="publish" className="mt-1 h-5 w-5 accent-[var(--color-bisturi)]" />
              <span>
                Publicar agora
                <span className="t-small block">Torna este o termo em vigor e substitui o anterior. Sem marcar, fica como rascunho.</span>
              </span>
            </label>
          </AdminForm>
        </section>

        <section aria-labelledby="historico">
          <h2 id="historico" className="t-h3 mb-4">
            Versões
          </h2>
          {terms.length === 0 ? (
            <Empty>Nenhuma versão cadastrada.</Empty>
          ) : (
            <ul className="border-t border-linha">
              {terms.map((t) => (
                <li key={t.id} className="border-b border-linha py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-medium">
                      Versão {t.version}
                      {t.active && <span className="ml-3 rounded-ctl border border-bisturi px-2 py-0.5 text-[0.8125rem] font-normal text-bisturi">Em vigor</span>}
                    </p>
                    {!t.active && (
                      <form action={activateTermAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmButton confirm={`Tornar a versão ${t.version} o termo em vigor?`}>Tornar em vigor</ConfirmButton>
                      </form>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-[0.9rem] text-cafe">{t.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
