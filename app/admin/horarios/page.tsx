/* =====================================================================
   ADMINISTRACIÓN: HORARIOS Y DISPONIBILIDAD (app/admin/horarios/page.tsx)
   ---------------------------------------------------------------------
   Página dedicada para configurar días de apertura, franjas y turnos.
   ===================================================================== */

import type { Metadata } from "next";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ScheduleConfig from "@/components/admin/ScheduleConfig";
import { getBusinessHours, getCurrentProfile } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Horarios y Disponibilidad - JM Barber Studio",
  description: "Configura turnos semanales, apertura, cierre y pausas de almuerzo.",
};

export default async function AdminHorariosPage() {
  const [adminUser, businessHours] = await Promise.all([
    getCurrentProfile("admin"),
    getBusinessHours(),
  ]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <AppHeader user={adminUser} currentRole="admin" />

      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)] flex-1">
        <div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-6">
          <div className="flex flex-col lg:flex-row gap-space-lg items-start">
            <AdminSidebar currentPath="/admin/horarios" adminUser={adminUser} />

            <section className="flex-1 w-full min-w-0 flex flex-col gap-6">
              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60">
                <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
                  Configuración Operativa
                </span>
                <h1 className="font-headline-md text-on-surface font-bold mt-1">
                  Horarios y Disponibilidad
                </h1>
                <p className="font-body-sm text-on-surface-variant mt-1">
                  Al modificar los horarios o días de atención, el calendario de reservas del cliente recalcula al instante los turnos y franjas permitidas.
                </p>
              </div>

              <ScheduleConfig initialHours={businessHours} />
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
