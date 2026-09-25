"use server";

import { redirect } from "next/navigation";
import { guarded, optStr, str, type ActionState } from "@/lib/admin-util";
import { digitsOnly } from "@/lib/format";

const PATHS = ["/admin/clientes", "/admin/dashboard"];

function validPhone(raw: string): string | null {
  const d = digitsOnly(raw);
  return d.length >= 10 && d.length <= 13 ? d : null;
}

export async function saveClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  const phone = validPhone(str(fd, "phone"));
  if (name.length < 2) return { error: "Informe o nome." };
  if (!phone) return { error: "Informe um telefone válido com DDD." };
  const id = str(fd, "id");

  return guarded(async (db) => {
    const row = { name, phone, email: optStr(fd, "email"), notes: optStr(fd, "notes") };
    if (id) await db.update("clients", id, row);
    else await db.insert("clients", row);
    return id ? "Cliente atualizado." : "Cliente cadastrado.";
  }, PATHS);
}

export async function deleteClientAction(fd: FormData): Promise<void> {
  const result = await guarded((db) => db.remove("clients", str(fd, "id")), PATHS);
  // Cliente com histórico não pode ser excluído (o banco protege); volta à ficha com o motivo.
  if (result?.error) redirect(`/admin/clientes/${str(fd, "id")}?erro=${encodeURIComponent("Esta cliente tem agendamentos, triagens, anamneses ou tratamentos e não pode ser excluída.")}`);
  redirect("/admin/clientes");
}
