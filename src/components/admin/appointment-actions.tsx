import { deleteAppointmentAction, setStatusAction } from "@/app/admin/(painel)/agendamentos/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { AppointmentStatus } from "@/lib/types";

function StatusForm({ id, status, label, confirm }: { id: string; status: AppointmentStatus; label: string; confirm?: string }) {
  return (
    <form action={setStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <ConfirmButton confirm={confirm}>{label}</ConfirmButton>
    </form>
  );
}

/** Botões de transição de status conforme o estado atual. */
export function AppointmentActions({ id, status, redirectToList = false }: { id: string; status: AppointmentStatus; redirectToList?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4">
      {status === "pending" && <StatusForm id={id} status="confirmed" label="Confirmar" />}
      {status === "confirmed" && <StatusForm id={id} status="completed" label="Concluir" />}
      {(status === "pending" || status === "confirmed") && <StatusForm id={id} status="cancelled" label="Cancelar" confirm="Cancelar este agendamento? O horário volta a ficar livre." />}
      {status === "cancelled" && <StatusForm id={id} status="pending" label="Reabrir" />}
      <form action={deleteAppointmentAction}>
        <input type="hidden" name="id" value={id} />
        {redirectToList && <input type="hidden" name="redirect" value="list" />}
        <ConfirmButton confirm="Excluir definitivamente este agendamento?" className="link-draw text-[0.9rem] text-alerta">
          Excluir
        </ConfirmButton>
      </form>
    </div>
  );
}
