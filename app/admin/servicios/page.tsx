/* =====================================================================
   ADMINISTRACIÓN: SERVICIOS DEL ESTUDIO (app/admin/servicios/page.tsx)
   ---------------------------------------------------------------------
   Página dedicada para gestionar, crear y activar/desactivar servicios.
   ===================================================================== */

import type { Metadata } from "next";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ServicesManager from "@/components/admin/ServicesManager";
import { getCurrentProfile, getServices } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Gestión de Servicios - JM Barber Studio",
  description: "Administra el catálogo de servicios, precios y visibilidad.",
};

export default async function AdminServiciosPage() {
  const [adminUser, services] = await Promise.all([
    getCurrentProfile("admin"),
    getServices(),
  ]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <AppHeader user={adminUser} currentRole="admin" />

      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)] flex-1">
        <div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-6">
          <div className="flex flex-col lg:flex-row gap-space-lg items-start">
            <AdminSidebar currentPath="/admin/servicios" adminUser={adminUser} />

            <section className="flex-1 w-full min-w-0 flex flex-col gap-6">
              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60">
                <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
                  Panel de Catálogo
                </span>
                <h1 className="font-headline-md text-on-surface font-bold mt-1">
                  Servicios y Experiencias
                </h1>
                <p className="font-body-sm text-on-surface-variant mt-1">
                  Todo cambio o nuevo servicio que guardes aquí aparecerá de inmediato en la página de inicio y en la zona de reservas de los clientes.
                </p>
              </div>

              <ServicesManager initialServices={services} />
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
