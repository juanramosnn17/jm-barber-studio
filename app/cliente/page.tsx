import type { Metadata } from "next";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import NextAppointmentCard from "@/components/booking/NextAppointmentCard";
import BookingWizard from "@/components/booking/BookingWizard";
import {
  getBusinessHours,
  getCurrentProfile,
  getNextAppointment,
  getServices,
} from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Área del Cliente",
  description: "Gestiona tu próxima cita y reserva un nuevo servicio en JM Barber Studio.",
};

interface ClientPageProps {
  searchParams: Promise<{ serviceId?: string }>;
}

export default async function ClientAreaPage({ searchParams }: ClientPageProps) {
  const resolvedParams = await searchParams;
  const initialServiceId = resolvedParams?.serviceId;

  // DATOS DE SUPABASE: Carga en paralelo del perfil, citas, servicios y horarios
  const [profile, services, businessHours] = await Promise.all([
    getCurrentProfile("cliente"),
    getServices({ onlyActive: true }),
    getBusinessHours(),
  ]);

  const nextAppointment = profile ? await getNextAppointment() : null;
  const firstName = profile ? profile.first_name : "Cliente";

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Header Autenticado del Cliente */}
      <AppHeader user={profile} currentRole="cliente" />

      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)] flex-1">
        <div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin pt-space-lg pb-space-xl flex flex-col gap-space-xl">
          {/* 1. SECCIÓN DE BIENVENIDA Y PRÓXIMA CITA */}
          <section className="flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                
                <h1 className="font-headline-lg text-on-surface tracking-tight">
                  Hola, {firstName}&nbsp;
                  <span className="inline-block transform hover:rotate-12 transition-transform cursor-default">
                    👋
                  </span>
                </h1>
                <p className="font-body-lg text-on-surface-variant">
                  Bienvenido, gestiona tu próxima cita o reserva un nuevo servicio.
                </p>
              </div>

              <a
                href="#booking-flow"
                className="px-6 py-3 rounded-full bg-primary text-on-primary hover:bg-neutral-800 shadow-md hover:shadow-lg transition-all flex items-center gap-2 font-label-lg group w-fit"
              >
                <span className="material-symbols-outlined text-secondary-fixed-dim group-hover:rotate-45 transition-transform text-[20px]">
                  add
                </span>
                <span>Reservar nueva cita</span>
              </a>
            </div>

            {/* Tarjeta de Próxima Cita Activa */}
            <NextAppointmentCard appointment={nextAppointment} />
          </section>

          {/* 2. FLUJO GUIADO DE RESERVA EN 4 PASOS */}
          <BookingWizard
            services={services}
            businessHours={businessHours}
            initialServiceId={initialServiceId}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
