import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getServices, getSettings } from "@/lib/queries";
import { addDaysISO, todayISO } from "@/lib/date";

export const metadata: Metadata = {
  title: "Agendar horário",
  description: "Escolha o procedimento, a data e o horário e agende online com Jennifer Camila.",
  alternates: { canonical: "/agendamento" },
};

// Depende do dia de hoje e de ?servico=: sempre dinâmica.
export const dynamic = "force-dynamic";

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ servico?: string }> }) {
  const [{ servico }, services, settings] = await Promise.all([searchParams, getServices(), getSettings()]);
  const today = todayISO();
  const initial = services.find((s) => s.slug === servico) ?? null;

  return (
    <div className="wrap pb-[var(--spacing-section)] pt-8 lg:pt-14" data-section="Agendamento">
      <h1 className="t-h1 mb-12 max-w-[16ch] lg:mb-20">Agendar horário</h1>
      {services.length === 0 ? (
        <p className="t-lead text-cafe">Os procedimentos ainda não foram publicados. Volte em breve.</p>
      ) : (
        <BookingFlow services={services} today={today} maxDate={addDaysISO(today, settings.max_days_ahead)} initialServiceId={initial?.id ?? null} />
      )}
    </div>
  );
}
