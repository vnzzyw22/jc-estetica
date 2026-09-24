import Image from "next/image";
import { saveContentAction } from "@/app/admin/(painel)/conteudo/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { CONTENT_FIELDS, contentWithFallbacks } from "@/lib/content";

export const metadata = { title: "Conteúdo" };

const GROUPS = ["Início", "Profissional", "Espaço", "Imagens"] as const;

export default async function ContentPage() {
  const { db } = await requireAdmin();
  const rows = await db.list("site_content");
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const merged = contentWithFallbacks(rows);

  return (
    <>
      <PageTitle title="Conteúdo" />
      <p className="mb-10 max-w-[62ch] text-cafe">
        Textos e fotos do site. O que estiver entre [colchetes] é um espaço reservado — substitua por informação real. WhatsApp, Instagram e endereço ficam em Configurações; perguntas frequentes, em FAQ.
      </p>

      <AdminForm action={saveContentAction} submitLabel="Salvar conteúdo" className="max-w-3xl">
        {GROUPS.map((group) => (
          <fieldset key={group} className="mb-12 grid gap-5">
            <legend className="t-h3 mb-4">{group}</legend>
            {CONTENT_FIELDS.filter((f) => f.group === group).map((f) => {
              if (f.kind === "image") {
                const url = stored.get(f.key);
                return (
                  <div key={f.key} className="grid gap-3 border-t border-linha pt-4 sm:grid-cols-[7rem_1fr]">
                    <div className="relative aspect-[4/5] w-28 overflow-hidden bg-nude">
                      {url ? <Image src={url} alt={f.label} fill sizes="112px" className="object-cover" /> : <span className="absolute inset-2 text-[0.75rem] text-cafe">Sem foto</span>}
                    </div>
                    <div>
                      <p className="mb-1 text-[0.9rem] font-medium">{f.label}</p>
                      {f.hint && <p className="t-small mb-2">{f.hint}</p>}
                      <input type="file" name={f.key} accept="image/jpeg,image/png,image/webp" className="text-[0.9rem]" aria-label={`Enviar ${f.label}`} />
                      {url && (
                        <label className="mt-2 flex items-center gap-2 text-[0.9rem]">
                          <input type="checkbox" name={`remove:${f.key}`} /> Remover foto atual
                        </label>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  {f.kind === "longtext" ? (
                    <textarea name={f.key} defaultValue={merged[f.key]} rows={4} className="field" />
                  ) : (
                    <input name={f.key} defaultValue={merged[f.key]} className="field" />
                  )}
                </Field>
              );
            })}
          </fieldset>
        ))}
      </AdminForm>
    </>
  );
}
