"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSessionClient } from "@/lib/supabase/server";
import { LOCAL_COOKIE } from "@/lib/local-auth";

export async function signOut() {
  if (isSupabaseConfigured) {
    await (await createSessionClient()).auth.signOut();
  } else {
    (await cookies()).delete(LOCAL_COOKIE);
  }
  redirect("/admin/login");
}
