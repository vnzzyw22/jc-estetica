/** Recados que voltam pela URL (`?erro=` e `?aviso=`) depois de uma ação de linha. Texto puro, limitado. */
export function Notice({ erro, aviso }: { erro?: string; aviso?: string }) {
  if (!erro && !aviso) return null;
  return erro ? (
    <p role="alert" className="mb-8 max-w-[64ch] border-l-2 border-alerta bg-alerta/5 px-4 py-3 text-[0.95rem] text-alerta">
      {erro.slice(0, 240)}
    </p>
  ) : (
    <p role="status" className="mb-8 max-w-[64ch] border-l-2 border-bisturi bg-bisturi/5 px-4 py-3 text-[0.95rem]">
      {aviso?.slice(0, 240)}
    </p>
  );
}
