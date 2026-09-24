import Link from "next/link";
import { saveClientAction } from "@/app/admin/(painel)/clientes/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { Empty, Field, PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { digitsOnly } from "@/lib/format";

export const metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { db } = await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().toLowerCase();

  const [clients, appointments] = await Promise.all([db.list("clients", { order: [["name", "asc"]] }), db.list("appointments")]);
  const counts = new Map<string, number>();
  for (const a of appointments) if (a.status !== "cancelled") counts.set(a.client_id, (counts.get(a.client_id) ?? 0) + 1);

  const digits = digitsOnly(q);
  const filtered = q ? clients.filter((c) => c.name.toLowerCase().includes(q) || (digits && c.phone.includes(digits)) || c.email?.toLowerCase().includes(q)) : clients;

  return (
    <>
      <PageTitle title="Clientes" />

      <form method="get" className="mb-8 flex max-w-md gap-3">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou e-mail…" aria-label="Buscar clientes" className="field" />
        <button type="submit" className="btn btn-sm btn-ghost">
          Buscar
        </button>
      </form>

      {filtered.length === 0 ? (
        <Empty>{q ? "Nenhum cliente encontrado." : "Nenhum cliente ainda. Eles aparecem aqui quando agendam pelo site."}</Empty>
      ) : (
        <ul className="border-t border-linha">
          {filtered.map((c) => (
            <li key={c.id} className="border-b border-linha">
              <Link href={`/admin/clientes/${c.id}`} className="grid gap-x-6 gap-y-1 py-3.5 transition-colors hover:bg-seda/60 md:grid-cols-[1fr_12rem_8rem]">
                <span className="font-medium">{c.name}</span>
                <span className="tnum text-cafe">{c.phone}</span>
                <span className="t-small md:text-right">{counts.get(c.id) ?? 0} agendamento(s)</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-12 max-w-2xl border border-linha px-5 py-4">
        <summary className="cursor-pointer font-medium">Cadastrar cliente</summary>
        <AdminForm action={saveClientAction} submitLabel="Cadastrar" resetOnSuccess className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <input name="name" className="field" required />
          </Field>
          <Field label="Telefone com DDD">
            <input name="phone" className="field" inputMode="tel" required />
          </Field>
          <Field label="E-mail (opcional)">
            <input name="email" type="email" className="field" />
          </Field>
          <Field label="Observações">
            <input name="notes" className="field" />
          </Field>
        </AdminForm>
      </details>
    </>
  );
}
