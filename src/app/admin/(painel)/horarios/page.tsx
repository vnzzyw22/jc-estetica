import { saveAvailabilityAction } from "@/app/admin/(painel)/horarios/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { hm, weekdayLong } from "@/lib/date";

export const metadata = { title: "Horários" };

// Segunda a domingo, na ordem em que a semana é lida no Brasil.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function HoursPage() {
  const { db } = await requireAdmin();
  const rows = await db.list("availability");
  const byDay = new Map(rows.map((r) => [r.weekday, r]));

  return (
    <>
      <PageTitle title="Horários" />
      <p className="mb-8 max-w-[60ch] text-cafe">
        Defina os dias e o expediente. O site só oferece horários dentro destas janelas, fora da pausa e sem bloqueios. Para feriados e férias, use Bloqueios.
      </p>

      <AdminForm action={saveAvailabilityAction} submitLabel="Salvar horários">
        <div className="border-t border-linha">
          {ORDER.map((d) => {
            const r = byDay.get(d);
            const label = weekdayLong(d);
            return (
              <fieldset key={d} className="grid gap-x-6 gap-y-3 border-b border-linha py-5 lg:grid-cols-[11rem_repeat(4,minmax(0,9rem))] lg:items-end">
                <legend className="sr-only">{label}</legend>
                <label className="flex min-h-11 items-center gap-3 font-medium capitalize">
                  <input type="checkbox" name={`open_${d}`} defaultChecked={r?.is_open ?? false} className="h-5 w-5 accent-[var(--color-bisturi)]" />
                  {label}
                </label>
                {(
                  [
                    ["open_time", "Abre", r?.open_time],
                    ["close_time", "Fecha", r?.close_time],
                    ["break_start", "Pausa de", r?.break_start],
                    ["break_end", "Pausa até", r?.break_end],
                  ] as const
                ).map(([name, text, value]) => (
                  <label key={name} className="block">
                    <span className="t-small mb-1 block">{text}</span>
                    <input type="time" name={`${name}_${d}`} defaultValue={hm(value)} className="field tnum" />
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      </AdminForm>
    </>
  );
}
