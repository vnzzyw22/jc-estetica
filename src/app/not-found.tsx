import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap flex min-h-dvh flex-col justify-center py-20">
      <p className="t-small">Erro 404</p>
      <h1 className="t-h1 mt-4 max-w-[14ch]">Página não encontrada.</h1>
      <p className="t-lead mt-6 max-w-[30ch] text-cafe">O endereço pode ter mudado ou nunca ter existido.</p>
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
        <Link href="/" className="btn">
          Ir para o início
        </Link>
        <Link href="/agendamento" className="link-draw self-center font-medium">
          Agendar horário
        </Link>
      </div>
    </main>
  );
}
