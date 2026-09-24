"use client";

import { useFormStatus } from "react-dom";

interface ConfirmButtonProps {
  children: React.ReactNode;
  /** Se informado, pede confirmação antes de enviar. */
  confirm?: string;
  className?: string;
}

/** Botão de submit para ações rápidas (uma linha de tabela) com confirmação opcional. */
export function ConfirmButton({ children, confirm, className = "link-draw text-[0.9rem]" }: ConfirmButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-9 disabled:opacity-40 ${className}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
