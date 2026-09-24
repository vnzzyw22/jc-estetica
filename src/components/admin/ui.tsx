import { STATUS_LABEL } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/types";

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-linha pb-5">
      <h1 className="t-h2">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[0.9rem] font-medium">{label}</span>
      {children}
      {hint && <span className="t-small mt-1 block">{hint}</span>}
    </label>
  );
}

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "border-rose text-espresso",
  confirmed: "border-bisturi text-bisturi",
  completed: "border-cafe text-cafe",
  cancelled: "border-linha text-cafe/60 line-through",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`inline-block rounded-ctl border px-2 py-0.5 text-[0.8125rem] ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-linha px-5 py-8 text-center text-cafe">{children}</p>;
}

/** Pequena métrica: número grande, rótulo pequeno. */
export function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="border-t border-espresso pt-3">
      <p className="tnum font-serif text-[2.75rem] font-light leading-none">{value}</p>
      <p className="t-small mt-2">{label}</p>
    </div>
  );
}
