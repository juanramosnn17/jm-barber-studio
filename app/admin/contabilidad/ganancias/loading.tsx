/* =====================================================================
   ESTADO DE CARGA DEL REPORTE DE CONTABILIDAD
   (app/admin/contabilidad/ganancias/loading.tsx)
   ===================================================================== */

export default function LoadingProfitReportPage() {
  return (
    <div
      role="progressbar"
      aria-label="Cargando reporte contable de ganancias"
      className="min-h-screen bg-surface pt-24 px-margin-mobile md:px-margin-tablet lg:px-margin"
    >
      <div className="max-w-[1440px] mx-auto flex flex-col gap-6 animate-pulse">
        <div className="h-24 rounded-2xl bg-surface-container-low" />
        <div className="h-40 rounded-2xl bg-surface-container-low" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-36 rounded-2xl bg-surface-container-low"
            />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-surface-container-low" />
      </div>
    </div>
  );
}
