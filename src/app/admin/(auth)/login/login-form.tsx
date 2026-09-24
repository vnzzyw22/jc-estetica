"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/app/admin/(auth)/login/actions";

export function LoginForm({ localMode }: { localMode: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, null);

  return (
    <form action={action} className="grid gap-5">
      {!localMode && (
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[0.9rem] font-medium">
            E-mail
          </label>
          <input id="email" name="email" type="email" autoComplete="username" spellCheck={false} required className="field" />
        </div>
      )}
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[0.9rem] font-medium">
          Senha
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" aria-describedby={state?.error ? "login-erro" : undefined} aria-invalid={Boolean(state?.error)} />
      </div>
      {state?.error && (
        <p id="login-erro" role="alert" className="text-[0.9rem] text-alerta">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
