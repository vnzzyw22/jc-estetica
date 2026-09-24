import Link from "next/link";
import { Reveal } from "@/components/site/reveal";

// Descreve o modelo de atendimento da Jennifer (triagem → avaliação → plano → sessões).
// A ordem é uma sequência real, por isso a linha do tempo.
const STEPS = [
  { title: "Triagem", text: "Você responde a poucas perguntas sobre o que procura e o que deseja mudar." },
  { title: "Avaliação", text: "A Jennifer analisa o seu caso e conversa com você para entender a necessidade." },
  { title: "Plano de tratamento", text: "Em vez de um procedimento isolado, um tratamento pensado para o seu objetivo." },
  { title: "Sessões e acompanhamento", text: "As sessões são agendadas com você e a evolução é acompanhada a cada etapa." },
];

export function Journey() {
  return (
    <section data-section="Como começa" className="wrap py-[var(--spacing-section)]">
      <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 className="t-h2">Como começa</h2>
            <p className="mt-5 max-w-[32ch] text-cafe">Antes de escolher um procedimento, entendemos o que você precisa.</p>
            <Link href="/triagem" className="btn mt-8">
              Descobrir meu tratamento
            </Link>
          </div>
        </div>

        <ol className="border-l border-linha pl-8 md:pl-12 lg:col-span-7 lg:col-start-6">
          {STEPS.map((s) => (
            <li key={s.title} className="relative pb-12 last:pb-0">
              <span aria-hidden className="absolute -left-[calc(2rem+4.5px)] top-3 h-2 w-2 rounded-full bg-bisturi md:-left-[calc(3rem+4.5px)]" />
              <Reveal>
                <h3 className="t-h3 lg:text-[2.25rem]">{s.title}</h3>
                <p className="mt-2 max-w-[46ch] text-cafe">{s.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
