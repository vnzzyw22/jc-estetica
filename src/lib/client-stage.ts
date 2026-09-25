// Etapa da relação com a cliente, calculada (nada é gravado): evita duas fontes de verdade.
// Arquivo PURO (sem imports com alias): roda nos testes unitários do Node.

export type ClientStage = "lead" | "cliente" | "em_tratamento";

export const STAGE_LABEL: Record<ClientStage, string> = {
  lead: "Lead",
  cliente: "Cliente",
  em_tratamento: "Em tratamento",
};

interface StageInput {
  screenings: Array<{ status: string }>;
  treatments: Array<{ status: string }>;
  appointments: Array<{ status: string; kind: string }>;
}

/**
 * - Em tratamento: existe tratamento ativo ou pausado.
 * - Cliente: já foi atendida (agendamento concluído ou tratamento concluído) ou tem agendamento ativo
 *   que não seja só a avaliação.
 * - Lead: enviou triagem e ainda não passou de "conversa/avaliação".
 * - Sem triagem e sem nada: cadastrada manualmente ou agendou direto, portanto cliente.
 */
export function clientStage({ screenings, treatments, appointments }: StageInput): ClientStage {
  if (treatments.some((t) => t.status === "active" || t.status === "paused")) return "em_tratamento";

  const attended = appointments.some((a) => a.status === "completed" && a.kind !== "evaluation") || treatments.some((t) => t.status === "completed");
  const bookedService = appointments.some((a) => a.status !== "cancelled" && a.kind !== "evaluation");
  if (attended || bookedService) return "cliente";

  if (screenings.length > 0) return "lead";
  return "cliente";
}
