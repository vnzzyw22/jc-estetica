import { dateTimeLabel } from "@/lib/date";
import { SOURCE_LABEL, labels } from "@/lib/screening";
import type { Client, ConsentTerm, Screening } from "@/lib/types";
import { maskPhone } from "@/lib/format";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-linha py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="t-small">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words">{children}</dd>
    </div>
  );
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/**
 * Dados enviados pela cliente na triagem (a pré-anamnese). Só leitura.
 * `compact` esconde o contato (na ficha o contato já está no cabeçalho).
 */
export function ScreeningData({ screening, client, term, compact = false }: { screening: Screening; client?: Client | null; term?: ConsentTerm | null; compact?: boolean }) {
  const a = screening.answers as Record<string, unknown>;
  return (
    <dl className="border-t border-linha">
      <Row label="Enviada em">
        <span className="tnum">{dateTimeLabel(screening.created_at)}</span>
      </Row>
      <Row label="Origem">
        {SOURCE_LABEL[screening.source] ?? screening.source}
        {screening.source_detail ? ` (${screening.source_detail})` : ""}
      </Row>
      {!compact && (
        <Row label="Contato">
          <span className="tnum">{client ? maskPhone(client.phone) : "—"}</span>
          {client?.email ? `\n${client.email}` : ""}
        </Row>
      )}
      <Row label="Área">{labels.area(screening.interest_area) ?? "Não informada"}</Row>
      <Row label="Queixa">{screening.complaint ?? "—"}</Row>
      <Row label="Objetivo">{labels.goal(screening.goal) ?? screening.goal ?? "—"}</Row>
      {screening.desired_outcome && <Row label="Resultado imaginado">{screening.desired_outcome}</Row>}
      {labels.duration(a.duration) && <Row label="Há quanto tempo">{labels.duration(a.duration)}</Row>}
      {labels.previous(a.previous_treatment) && <Row label="Tratamento anterior">{labels.previous(a.previous_treatment)}</Row>}
      {text(a.notes) && <Row label="Observação da cliente">{text(a.notes)}</Row>}
      {labels.period(a.preferred_period) && <Row label="Período preferido">{labels.period(a.preferred_period)}</Row>}
      {labels.visits(a.visits_per_month) && <Row label="Vezes por mês">{labels.visits(a.visits_per_month)}</Row>}
      {labels.contact(a.contact_preference) && <Row label="Prefere contato por">{labels.contact(a.contact_preference)}</Row>}
      {term !== undefined && (
        <Row label="Consentimento">
          {screening.consented_at ? (
            <>
              Aceito em <span className="tnum">{dateTimeLabel(screening.consented_at)}</span>
              <br />
              {term ? `Termo versão ${term.version}` : "Sem termo publicado no momento (ambiente de desenvolvimento)"}
            </>
          ) : (
            "Não registrado"
          )}
        </Row>
      )}
    </dl>
  );
}
