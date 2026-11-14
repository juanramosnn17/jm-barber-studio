/* =====================================================================
   MENSAJE DE ERROR (components/ui/ErrorMessage.tsx)
   ---------------------------------------------------------------------
   Aviso estándar cuando una acción del servidor responde { ok: false }
   (por ejemplo, si Supabase rechazó el cambio). Tarea 3.12.
   ===================================================================== */

export default function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="p-3.5 rounded-xl flex items-center gap-2 text-sm bg-error-container text-on-error-container"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        error
      </span>
      <span className="font-medium">{message}</span>
    </div>
  );
}
