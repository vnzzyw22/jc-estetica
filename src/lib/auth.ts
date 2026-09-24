import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/server";
import { LOCAL_COOKIE, isLocalAuthAllowed, localAuthToken } from "@/lib/local-auth";
import { getAdminDb } from "@/lib/data";
import type { Db } from "@/lib/data/db";

export interface AdminUser {
  email: string;
}

export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  if (!isSupabaseConfigured) {
    if (!isLocalAuthAllowed()) return null;
    const token = (await cookies()).get(LOCAL_COOKIE)?.value;
    return token === localAuthToken() ? { email: "admin local (desenvolvimento)" } : null;
  }

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Ter conta no Auth não basta: precisa estar em admin_profiles.
  const { data } = await supabase.from("admin_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? { email: user.email ?? "admin" } : null;
});

/** Garante admin autenticado. Devolve o Db com a sessão dele. */
export async function requireAdmin(): Promise<{ user: AdminUser; db: Db }> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return { user, db: await getAdminDb() };
}
