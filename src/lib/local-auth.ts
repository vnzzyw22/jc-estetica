import { createHash } from "node:crypto";

// Autenticação do modo local (SEM Supabase). Só existe para desenvolvimento/QA:
// em produção o modo local não autentica ninguém (ver isLocalAuthAllowed).

export const LOCAL_COOKIE = "jc_local_admin";

const password = () => process.env.ADMIN_LOCAL_PASSWORD || "dev-admin";

export const isLocalAuthAllowed = () => process.env.NODE_ENV !== "production";

export function localAuthToken(): string {
  return createHash("sha256").update(`jc-local:${password()}`).digest("hex");
}

export function checkLocalPassword(input: string): boolean {
  return isLocalAuthAllowed() && input === password();
}
