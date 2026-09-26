// Fila de atenção do dashboard: o que exige uma ação da Jennifer agora, do mais urgente ao menos.
// Arquivo PURO (sem imports com alias): roda nos testes unitários. Só entra o que é maior que zero;
// tudo em dia devolve lista vazia.

export interface AttentionInput {
  /** Triagens com estado "nova": o lead está esperando retorno. */
  newScreenings: number;
  /** Agendamentos futuros ainda pendentes de confirmação. */
  pendingAppointments: number;
  /** Sessões marcadas cujo horário já passou sem serem marcadas como realizadas (tratamento em andamento). */
  sessionsToClose: number;
  /** Tratamentos em andamento com sessões a agendar e nenhuma com horário. */
  activeWithoutNext: number;
  overdueReceivable: { count: number; total: number };
  overdueExpense: { count: number; total: number };
}

export interface AttentionItem {
  key: "receber" | "sessoes" | "triagens" | "confirmar" | "sem-sessao" | "despesas";
  text: string;
  href: string;
  /** Valor em reais, quando o item é dinheiro. */
  amount?: number;
  /** "late": já passou do ponto (atrasado). "todo": precisa de uma ação, sem atraso. */
  tone: "late" | "todo";
}

const one = (n: number, singular: string, plural: string): string => `${n} ${n === 1 ? singular : plural}`;

export function attentionItems(i: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (i.overdueReceivable.count > 0) {
    items.push({
      key: "receber",
      tone: "late",
      text: one(i.overdueReceivable.count, "recebimento atrasado", "recebimentos atrasados"),
      amount: i.overdueReceivable.total,
      href: "/admin/financeiro/recebimentos?filtro=atrasados",
    });
  }
  if (i.sessionsToClose > 0) {
    items.push({
      key: "sessoes",
      tone: "late",
      text: i.sessionsToClose === 1 ? "1 sessão passou sem ser marcada como realizada" : `${i.sessionsToClose} sessões passaram sem serem marcadas como realizadas`,
      href: "/admin/tratamentos?filtro=active",
    });
  }
  if (i.newScreenings > 0) {
    items.push({ key: "triagens", tone: "todo", text: one(i.newScreenings, "triagem nova esperando retorno", "triagens novas esperando retorno"), href: "/admin/triagens?status=new" });
  }
  if (i.pendingAppointments > 0) {
    items.push({ key: "confirmar", tone: "todo", text: one(i.pendingAppointments, "agendamento aguardando confirmação", "agendamentos aguardando confirmação"), href: "/admin/agendamentos?status=pending" });
  }
  if (i.activeWithoutNext > 0) {
    items.push({ key: "sem-sessao", tone: "todo", text: one(i.activeWithoutNext, "tratamento em andamento sem sessão marcada", "tratamentos em andamento sem sessão marcada"), href: "/admin/tratamentos?filtro=active" });
  }
  if (i.overdueExpense.count > 0) {
    items.push({
      key: "despesas",
      tone: "late",
      text: one(i.overdueExpense.count, "despesa atrasada", "despesas atrasadas"),
      amount: i.overdueExpense.total,
      href: "/admin/financeiro/despesas?filtro=atrasadas",
    });
  }

  return items;
}

/** Agrupa agendamentos por data local já calculada (YYYY-MM-DD), preservando a ordem de entrada. */
export function partitionByDay<T>(rows: T[], dayOf: (row: T) => string, today: string, lastDay: string): { today: T[]; later: T[] } {
  const result = { today: [] as T[], later: [] as T[] };
  for (const row of rows) {
    const d = dayOf(row);
    if (d === today) result.today.push(row);
    else if (d > today && d <= lastDay) result.later.push(row);
  }
  return result;
}
