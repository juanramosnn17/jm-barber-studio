import Image from "next/image";
import Link from "next/link";
import BrandLogo from "@/components/ui/BrandLogo";
import Footer from "@/components/layout/Footer";
import { getServices } from "@/lib/data/queries";
import { formatPrice } from "@/lib/format";

export default async function HomePage() {
  const services = await getServices({ onlyActive: true });

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Header Público */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-surface-container-high/40">
        <div className="h-20 max-w-[1440px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin flex items-center justify-between">
          <Link href="/" className="flex items-center gap-space-sm hover:opacity-90 transition-opacity">
            <BrandLogo className="h-8 w-auto" />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-full font-label-md text-on-surface hover:text-secondary transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary font-label-md hover:bg-neutral-800 transition-all shadow-sm"
            >
              Reservar Cita
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full pt-28 pb-space-xl flex-1 flex flex-col items-center">
        <div className="max-w-[1200px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin text-center flex flex-col items-center gap-space-lg">
        

          {/* Título Principal */}
          <p className="font-body-lg text-on-surface-variant max-w-2xl text-center">
            Experimenta una sesión de barbería exclusiva en un ambiente diseñado para tu comodidad y distinción. Reserva tu turno en segundos.
          </p>

          {/* Botones de Acción */}
          {/* EDITAR AQUÍ: Enlaces de llamada a la acción */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/login?return_url=/cliente%23booking-flow"
              className="px-8 py-3.5 rounded-full bg-primary text-on-primary font-label-lg hover:bg-neutral-800 shadow-md flex items-center gap-2 group transition-all"
            >
              <span>Reservar mi turno</span>
              <span className="material-symbols-outlined text-[20px] text-secondary-fixed transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </Link>
            <Link
              href="/login?return_url=/admin"
              className="px-6 py-3.5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high font-label-lg border border-surface-container-high transition-all"
            >
              Panel Administrativo
            </Link>
          </div>

          {/* Catálogo Visual de Servicios */}
          <div className="w-full mt-space-xl text-left">
            <div className="flex items-center justify-between mb-space-md border-b border-surface-container-high/60 pb-2">
              <div>
                <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
                  Nuestros Servicios
                </span>
                <h2 className="font-headline-md text-on-surface font-bold">
                  Catálogo Exclusivo
                </h2>
              </div>
              <Link
                href="/login?return_url=/cliente%23booking-flow"
                className="font-label-md text-secondary hover:underline flex items-center gap-1"
              >
                <span>Ver agenda</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 6).map((service) => (
                <div
                  key={service.id}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-surface-container-high/60 flex flex-col hover:shadow-md transition-shadow group"
                >
                  <Link
                    href={`/login?return_url=/cliente%23booking-flow&serviceId=${service.id}`}
                    className="h-48 relative bg-surface-container-high block overflow-hidden"
                  >
                    {service.image_url ? (
                      <Image
                        src={service.image_url}
                        alt={service.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                          {service.icon}
                        </span>
                      </div>
                    )}
                  </Link>
                  <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/login?return_url=/cliente%23booking-flow&serviceId=${service.id}`}
                          className="font-title-lg font-bold text-on-surface hover:text-secondary transition-colors"
                        >
                          {service.name}
                        </Link>
                        <span className="font-title-lg font-bold text-secondary shrink-0">
                          {formatPrice(service.price)}
                        </span>
                      </div>
                      <p className="font-body-sm text-on-surface-variant mt-2 line-clamp-2">
                        {service.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-surface-container-high/60">
                      <span className="font-label-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-secondary">
                          schedule
                        </span>
                        {service.duration_label}
                      </span>
                      <Link
                        href={`/login?return_url=/cliente%23booking-flow&serviceId=${service.id}`}
                        className="px-3.5 py-1.5 rounded-full bg-surface-container-low text-on-surface font-label-md hover:bg-primary hover:text-on-primary transition-colors text-xs font-semibold"
                      >
                        Reservar
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
