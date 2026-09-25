import { STAGE_LABEL, type ClientStage } from "@/lib/client-stage";

const STYLE: Record<ClientStage, string> = {
  lead: "border-rose text-espresso",
  cliente: "border-cafe text-cafe",
  em_tratamento: "border-bisturi text-bisturi",
};

/** Etapa da relação com a cliente (calculada). */
export function StageChip({ stage }: { stage: ClientStage }) {
  return <span className={`inline-block rounded-ctl border px-2 py-0.5 text-[0.8125rem] ${STYLE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}
