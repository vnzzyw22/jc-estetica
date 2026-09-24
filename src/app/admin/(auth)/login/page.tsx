import type { Metadata } from "next";
import { LoginForm } from "@/app/admin/(auth)/login/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default function LoginPage() {
  const localMode = !isSupabaseConfigured;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-[var(--spacing-gutter)] py-16">
      <p className="font-serif text-xl font-light">Jennifer Camila</p>
      <h1 className="t-h2 mt-6">Painel</h1>
      <div className="mt-10">
        <LoginForm localMode={localMode} />
      </div>
      {localMode && process.env.NODE_ENV !== "production" && (
        <p className="t-small mt-8 border-l-2 border-rose pl-3">
          Modo de desenvolvimento, sem Supabase: entre com a senha definida em ADMIN_LOCAL_PASSWORD (padrão: dev-admin). Em produção, o acesso usa o Supabase Auth.
        </p>
      )}
    </main>
  );
}
