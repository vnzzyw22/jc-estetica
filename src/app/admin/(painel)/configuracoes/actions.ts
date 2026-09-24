"use server";

import { bool, guarded, num, optStr, str, type ActionState } from "@/lib/admin-util";
import { digitsOnly } from "@/lib/format";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export async function saveSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "business_name");
  if (name.length < 2) return { error: "Informe o nome da marca." };
  const whatsapp = optStr(fd, "whatsapp");
  if (whatsapp && digitsOnly(whatsapp).length < 10) return { error: "WhatsApp inválido. Use DDD + número." };
  const email = optStr(fd, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "E-mail inválido." };

  const interval = Math.round(num(fd, "slot_interval_minutes", 30));
  const notice = Math.round(num(fd, "min_notice_hours", 2));
  const ahead = Math.round(num(fd, "max_days_ahead", 60));
  const buffer = Math.round(num(fd, "buffer_minutes", 0));
  if (interval < 5 || interval > 240) return { error: "O intervalo entre horários deve ficar entre 5 e 240 minutos." };
  if (notice < 0 || buffer < 0) return { error: "Antecedência e intervalo entre atendimentos não podem ser negativos." };
  if (ahead < 1 || ahead > 365) return { error: "A janela de agendamento deve ficar entre 1 e 365 dias." };

  return guarded(async (db) => {
    await db.upsert("settings", {
      id: SETTINGS_ID,
      business_name: name,
      business_tagline: str(fd, "business_tagline") || "Estética facial e corporal",
      whatsapp,
      instagram: optStr(fd, "instagram"),
      email,
      address: optStr(fd, "address"),
      city: optStr(fd, "city"),
      slot_interval_minutes: interval,
      min_notice_hours: notice,
      max_days_ahead: ahead,
      buffer_minutes: buffer,
      auto_confirm: bool(fd, "auto_confirm"),
    });
    return "Configurações salvas.";
  }, ["/", "/agendamento", "/contato", "/sobre", "/faq", "/tratamentos", "/admin/configuracoes"]);
}
