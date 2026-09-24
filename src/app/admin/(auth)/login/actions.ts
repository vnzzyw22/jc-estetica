"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/server";
import { LOCAL_COOKIE, checkLocalPassword, localAuthToken } from "@/lib/local-auth";

export type LoginState = { error?: string } | null;

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!isSupabaseConfigured) {
    if (!checkLocalPassword(password)) return { error: "Senha incorreta." };
    (await cookies()).set(LOCAL_COOKIE, localAuthToken(), { httpOnly: true, sameSite: "lax", path: "/" });
    redirect("/admin/dashboard");
  }

  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "E-mail ou senha incorretos." };

  // Autenticar não basta: a conta precisa estar em admin_profiles.
  const { data: profile } = await supabase.from("admin_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Esta conta não tem acesso ao painel." };
  }

  redirect("/admin/dashboard");
}
