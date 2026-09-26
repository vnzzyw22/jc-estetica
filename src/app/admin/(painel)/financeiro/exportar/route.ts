import type { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { getAdminDb } from "@/lib/data";
import { dateBR, todayISO } from "@/lib/date";
import { csvLine, isMonth } from "@/lib/finance";
import { loadClientMap, loadMonthFlow } from "@/lib/finance-data";
import { EXPENSE_KIND_LABEL, PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/format";

/** Planilha do mês (CSV com ";" e vírgula decimal, abre direto no Excel em português). Só administradora. */
export async function GET(request: NextRequest) {
  if (!(await getAdminUser())) return new Response("Não autorizado.", { status: 401 });

  const param = request.nextUrl.searchParams.get("mes");
  const month = isMonth(param) ? param : todayISO().slice(0, 7);

  const db = await getAdminDb();
  const [rows, clients] = await Promise.all([loadMonthFlow(db, month), loadClientMap(db)]);

  const lines = [csvLine(["Data", "Tipo", "Situação", "Descrição", "Cliente", "Forma ou categoria", "Natureza", "Valor"])];
  for (const r of rows) {
    const incoming = r.direction === "in";
    lines.push(
      csvLine([
        dateBR(r.occurred_on),
        incoming ? "Entrada" : "Saída",
        r.state === "realized" ? (incoming ? "Recebido" : "Pago") : incoming ? "A receber" : "A pagar",
        r.description,
        r.client_id ? (clients.get(r.client_id)?.name ?? "") : "",
        incoming ? (r.method ? PAYMENT_METHOD_LABEL[r.method] : "") : r.category_name,
        incoming ? PAYMENT_KIND_LABEL[r.category] : EXPENSE_KIND_LABEL[r.category],
        // Saída com sinal negativo: a coluna soma direto na planilha.
        incoming ? r.amount : -r.amount,
      ]),
    );
  }

  // BOM para o Excel reconhecer UTF-8 (acentos).
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
