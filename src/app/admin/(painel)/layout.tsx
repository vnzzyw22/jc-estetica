import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/admin/(painel)/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Painel", template: "%s — Painel" }, robots: { index: false, follow: false } };

// Painel: sempre dinâmico e autenticado.
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, db } = await requireAdmin();
  const newScreenings = (await db.list("screenings", { eq: { status: "new" } })).length;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-espresso focus:px-4 focus:py-2 focus:text-porcelana">
        Pular para o conteúdo
      </a>
      <aside className="border-b border-linha px-[var(--spacing-gutter)] py-3 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r lg:px-4 lg:py-8">
        <div className="mb-3 flex items-center justify-between lg:mb-8 lg:block">
          <Link href="/admin/dashboard" className="font-serif text-xl font-light">
            Jennifer Camila
          </Link>
          <Link href="/" target="_blank" className="link-draw text-[0.85rem] text-cafe lg:mt-2 lg:block lg:w-fit">
            Ver site
          </Link>
        </div>
        <AdminNav newScreenings={newScreenings} />
        <form action={signOut} className="hidden lg:absolute lg:bottom-6 lg:left-4 lg:right-4 lg:block">
          <p className="t-small mb-2 truncate">{user.email}</p>
          <button type="submit" className="link-draw min-h-9 text-[0.9rem]">
            Sair
          </button>
        </form>
      </aside>

      <main id="conteudo" className="min-w-0 px-[var(--spacing-gutter)] py-8 lg:px-10 lg:py-10">
        {children}
        <form action={signOut} className="mt-16 border-t border-linha pt-4 lg:hidden">
          <p className="t-small mb-1">{user.email}</p>
          <button type="submit" className="link-draw min-h-11 text-[0.9rem]">
            Sair
          </button>
        </form>
      </main>
    </div>
  );
}
