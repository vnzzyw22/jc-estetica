import Link from "next/link";
import { NextSlot } from "@/components/site/next-slot";
import { whatsappLink } from "@/lib/whatsapp";
import type { Settings } from "@/lib/types";

// Os quatro passos SÃO uma sequência real do fluxo: numeração justificada aqui.
const STEPS = [
  { title: "Procedimento", text: "Escolha o que quer fazer e veja duração e valor antes de decidir." },
  { title: "Data e horário", text: "A agenda mostra só o que está livre de verdade." },
  { title: "Seus dados", text: "Nome e WhatsApp. E-mail é opcional." },
  { title: "Confirmação", text: "Você recebe o resumo na tela e a Jennifer confirma por WhatsApp." },
];

export function BookingTeaser({ settings }: { settings: Settings }) {
  const wa = whatsappLink(settings.whatsapp, "Olá! Tenho uma dúvida antes de agendar.");

  return (
    <section data-section="Agendamento" className="on-dark bg-espresso text-porcelana">
      <div className="wrap py-[var(--spacing-section)]">
        <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-6">
          <div className="lg:col-span-6">
            <h2 className="t-h1">Seu horário, sem troca de mensagens.</h2>
          </div>
          <div className="flex flex-col justify-end gap-6 lg:col-span-4 lg:col-start-9">
            <NextSlot className="text-[1.05rem]" />
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/agendamento" className="btn">
                Agendar horário
              </Link>
              {wa && (
                <a href={wa} className="link-draw" target="_blank" rel="noopener noreferrer">
                  Tirar uma dúvida no WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        <ol className="mt-16 grid gap-x-6 gap-y-0 lg:mt-24 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t border-linha-clara py-6 lg:pb-0">
              <span className="tnum text-[0.875rem] opacity-60">{i + 1}</span>
              <h3 className="t-h3 mt-3">{s.title}</h3>
              <p className="mt-2 max-w-[30ch] text-[0.95rem] opacity-75">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
