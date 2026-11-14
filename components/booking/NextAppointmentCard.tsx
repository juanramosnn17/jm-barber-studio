"use client";

import { useState, useTransition } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import type { AppointmentWithDetails } from "@/lib/types";
import { formatLongDate, formatTime12h } from "@/lib/format";
import { updateAppointmentStatusAction } from "@/lib/actions";

interface NextAppointmentCardProps {
  appointment: AppointmentWithDetails | null;
}

export default function NextAppointmentCard({ appointment }: NextAppointmentCardProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!appointment) {
    return (
      <div className="w-full rounded-3xl bg-surface-container-lowest p-space-xl shadow-md flex flex-col items-center justify-center text-center gap-space-md border border-surface-container-high/60">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-secondary">
          <span className="material-symbols-outlined text-3xl">calendar_month</span>
        </div>
        <div>
          <h3 className="font-headline-sm text-on-surface">No tienes citas próximas</h3>
          <p className="font-body-sm text-on-surface-variant max-w-sm mt-1">
            Reserva tu próximo corte o arreglo de barba abajo en sencillos pasos.
          </p>
        </div>
        <a
          href="#booking-flow"
          className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md hover:bg-neutral-800 transition-colors shadow-sm"
        >
          Ver servicios disponibles
        </a>
      </div>
    );
  }

  const handleCancel = () => {
    if (confirm("¿Estás seguro de que deseas cancelar esta cita?")) {
      setErrorMessage(null);
      startTransition(async () => {
        const res = await updateAppointmentStatusAction(appointment.id, "cancelada");
        if (!res.ok) {
          setErrorMessage(res.message || "No se pudo cancelar la cita.");
        }
      });
    }
  };

  return (
    <div className="w-full rounded-3xl bg-surface-container-lowest p-space-xl shadow-md flex flex-col gap-space-lg relative overflow-hidden">
      {/* Indicador de estado */}
      <div className="flex items-center justify-between border-b border-surface-variant/40 pb-space-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
          <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
            Próxima Cita
          </span>
        </div>
        <span className="px-3 py-1 rounded-full font-label-sm bg-secondary-fixed/40 text-on-secondary-fixed flex items-center gap-1.5 font-bold capitalize">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          {appointment.status}
        </span>
      </div>

      {/* Tarjeta interior con fecha y detalles */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center bg-surface-container-low p-space-md sm:p-space-lg rounded-2xl">
        <div className="md:col-span-5 flex flex-col gap-1">
          <span className="font-label-sm text-secondary uppercase font-bold tracking-wider">
            Servicio seleccionado
          </span>
          <h2 className="font-headline-md text-on-surface font-bold">
            {appointment.service_name}
          </h2>
          {appointment.barber_name && (
            <p className="font-body-sm text-on-surface-variant">
              Barbero: <span className="font-semibold text-on-surface">{appointment.barber_name}</span>{" "}
              {appointment.chair ? `(${appointment.chair})` : ""}
            </p>
          )}
        </div>

        <div className="md:col-span-7 flex items-center gap-space-md">
          <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">event</span>
          </div>
          <div className="flex flex-col">
            <span className="font-title-md text-on-surface font-semibold">
              {formatLongDate(appointment.date)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {formatTime12h(appointment.time)} • {appointment.duration_label || "Duración estándar"}
            </span>
          </div>
        </div>
      </div>

      {/* Botones de acción de la cita */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
        {errorMessage && <ErrorMessage message={errorMessage} />}
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="py-2.5 px-6 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors font-label-lg disabled:opacity-50"
          >
            {isPending ? "Cancelando..." : "Cancelar cita"}
          </button>
        </div>
      </div>
    </div>
  );
}
