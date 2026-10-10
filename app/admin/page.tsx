import type { Metadata } from "next";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import AdminSidebar from "@/components/admin/AdminSidebar";
import DailyAppointmentsList from "@/components/admin/DailyAppointmentsList";
import {
  getAppointmentsByDate,
  getCurrentProfile,
} from "@/lib/data/queries";
import { toISODate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Panel del Administrador",
  description: "Control de flujo de citas del día en JM Barber Studio.",
};

export default async function AdminDashboardPage() {
  const todayISO = toISODate(new Date());

  // DATOS DE SUPABASE: Carga de citas de la jornada
  const [adminUser, appointments] = await Promise.all([
    getCurrentProfile("admin"),
    getAppointmentsByDate(todayISO),
  ]);

  const confirmadasCount = appointments.filter((a) => a.status === "confirmada").length;
  const pendientesCount = appointments.filter((a) => a.status === "pendiente").length;
  const completadasCount = appointments.filter((a) => a.status === "completada").length;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Header con rol admin */}
      <AppHeader user={adminUser} currentRole="admin" />

      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)] flex-1">
        <div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-space-md">
          <div className="flex flex-col lg:flex-row gap-space-lg items-start">
            {/* Sidebar lateral fijo con /admin (Citas) preseleccionado */}
            <AdminSidebar currentPath="/admin" adminUser={adminUser} />

            {/* Contenido principal exclusivo de CITAS */}
            <section className="flex-1 w-full min-w-0 flex flex-col gap-space-lg">
              {/* Tarjetas informativas de KPI exclusivas de Citas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-1 border border-surface-container-high/60">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span className="font-label-sm uppercase tracking-wide">Citas Totales</span>
                    <span className="material-symbols-outlined text-[20px] text-secondary">
                      calendar_today
                    </span>
                  </div>
                  <span className="font-headline-md text-on-surface font-bold mt-1">
                    {appointments.length}
                  </span>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-1 border border-surface-container-high/60">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span className="font-label-sm uppercase tracking-wide">Confirmadas</span>
                    <span className="material-symbols-outlined text-[20px] text-green-600">
                      check_circle
                    </span>
                  </div>
                  <span className="font-headline-md text-on-surface font-bold mt-1">
                    {confirmadasCount}
                  </span>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-1 border border-surface-container-high/60">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span className="font-label-sm uppercase tracking-wide">Pendientes</span>
                    <span className="material-symbols-outlined text-[20px] text-amber-500">
                      hourglass_top
                    </span>
                  </div>
                  <span className="font-headline-md text-on-surface font-bold mt-1">
                    {pendientesCount}
                  </span>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-1 border border-surface-container-high/60">
                  <div className="flex items-center justify-between text-on-surface-variant">
                    <span className="font-label-sm uppercase tracking-wide">Completadas</span>
                    <span className="material-symbols-outlined text-[20px] text-secondary">
                      task_alt
                    </span>
                  </div>
                  <span className="font-headline-md text-on-surface font-bold mt-1">
                    {completadasCount}
                  </span>
                </div>
              </div>

              {/* Módulo Exclusivo: Citas y Flujo de Sillones de Hoy */}
              <DailyAppointmentsList initialAppointments={appointments} />
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
