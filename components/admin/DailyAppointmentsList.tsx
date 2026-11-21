"use client";

import { useState, useTransition } from "react";
import type { AppointmentStatus, AppointmentWithDetails } from "@/lib/types";
import { formatTime12h } from "@/lib/format";
import { updateAppointmentStatusAction } from "@/lib/actions";
import ErrorMessage from "@/components/ui/ErrorMessage";

interface DailyAppointmentsListProps {
  initialAppointments: AppointmentWithDetails[];
}

export default function DailyAppointmentsList({
  initialAppointments,
}: DailyAppointmentsListProps) {
  const [filter, setFilter] = useState<"todas" | AppointmentStatus>("todas");
  const [appointments, setAppointments] = useState(initialAppointments);
  const [, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Cita cuya cancelación espera el segundo clic de confirmación (tarea 4.14)
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

  const filteredAppointments = appointments.filter((app) => {
    if (filter === "todas") return true;
    return app.status === filter;
  });

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    const previous = appointments;
    setErrorMessage(null);
    startTransition(async () => {
      // Optimistic update
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
      );
      const res = await updateAppointmentStatusAction(id, newStatus);
      if (!res.ok) {
        // Revertir: el cambio no se guardó
        setAppointments(previous);
        setErrorMessage(res.message || "No se pudo actualizar la cita.");
      } else if (newStatus === "cancelada") {
        // La agenda no muestra canceladas: la cita sale de la lista y su turno queda libre
        setAppointments((prev) => prev.filter((a) => a.id !== id));
      }
    });
  };

  const handleCancelConfirmed = (id: string) => {
    setConfirmingCancelId(null);
    handleStatusChange(id, "cancelada");
  };

  return (
    <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md">
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <h2 className="font-title-lg text-on-surface">Citas del Día</h2>
          <p className="font-body-sm text-on-surface-variant">
            Control de la agenda diaria en tiempo real
          </p>
        </div>

        {/* Filtros Rápidos Chips */}
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          <button
            type="button"
            onClick={() => setFilter("todas")}
            className={`px-4 py-1.5 rounded-full font-label-md transition-all ${
              filter === "todas"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Todas ({appointments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pendiente")}
            className={`px-4 py-1.5 rounded-full font-label-md transition-all ${
              filter === "pendiente"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Pendientes ({appointments.filter((a) => a.status === "pendiente").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("confirmada")}
            className={`px-4 py-1.5 rounded-full font-label-md transition-all ${
              filter === "confirmada"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Confirmadas ({appointments.filter((a) => a.status === "confirmada").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("completada")}
            className={`px-4 py-1.5 rounded-full font-label-md transition-all ${
              filter === "completada"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Completadas ({appointments.filter((a) => a.status === "completada").length})
          </button>
        </div>
      </div>

      {/* Lista de Citas */}
      <div className="flex flex-col gap-space-sm">
        {filteredAppointments.length === 0 ? (
          <p className="p-8 text-center text-on-surface-variant font-body-md bg-surface-container-low rounded-xl">
            No hay citas registradas en este estado.
          </p>
        ) : (
          filteredAppointments.map((app) => {
            const isCompleted = app.status === "completada";
            const isConfirmed = app.status === "confirmada";
            const isPending = app.status === "pendiente";

            return (
              <div
                key={app.id}
                className={`p-space-md rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-space-md transition-colors ${
                  isConfirmed
                    ? "bg-surface-container shadow-sm border border-secondary/20"
                    : "bg-surface-container-low"
                }`}
              >
                {/* Hora y Datos del Cliente */}
                <div className="flex items-center gap-space-md">
                  <div
                    className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl shrink-0 ${
                      isConfirmed
                        ? "bg-primary text-on-primary"
                        : "bg-surface text-on-surface-variant"
                    }`}
                  >
                    <span className="font-title-md font-bold leading-none">
                      {formatTime12h(app.time).split(" ")[0]}
                    </span>
                    <span
                      className={`font-label-sm uppercase ${
                        isConfirmed ? "text-secondary-fixed" : ""
                      }`}
                    >
                      {formatTime12h(app.time).split(" ")[1]}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-title-md font-semibold text-on-surface">
                        {app.client_name || "Cliente eliminado"}
                      </span>
                    </div>
                    <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm mt-0.5">
                      <span>{app.service_name}</span>
                      {(app.end_time || app.duration_label) && (
                        <>
                          <span className="text-outline-variant">•</span>
                          {/* Con la API se conoce el fin real congelado al reservar (tarea 4.12) */}
                          <span>{app.end_time ? `${app.time} – ${app.end_time}` : app.duration_label}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones de Estado */}
                <div className="flex items-center justify-between md:justify-end gap-space-sm shrink-0">
                  {isCompleted && (
                    <span className="px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-label-sm tracking-wide uppercase">
                      Completada
                    </span>
                  )}

                  {isConfirmed && confirmingCancelId !== app.id && (
                    <>
                      <span className="px-3 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-sm tracking-wide font-semibold">
                        Confirmada
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app.id, "completada")}
                        className="h-9 px-4 rounded-full bg-primary text-on-primary hover:bg-primary/85 transition-colors font-label-md shadow-sm flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px] text-secondary-fixed">
                          check
                        </span>
                        <span>Completar</span>
                      </button>
                      {/* Cancelar una cita confirmada libera su turno (spec F3, tarea 4.14) */}
                      <button
                        type="button"
                        onClick={() => setConfirmingCancelId(app.id)}
                        aria-label={`Cancelar la cita de ${app.client_name || "este cliente"} a las ${app.time}`}
                        className="h-9 px-3.5 rounded-full bg-surface-container text-on-surface-variant hover:text-error transition-colors font-label-md"
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {isConfirmed && confirmingCancelId === app.id && (
                    <div role="group" aria-label="Confirmar cancelación" className="flex flex-wrap items-center gap-2">
                      <span className="font-label-md text-on-surface">¿Cancelar la cita? El turno quedará libre.</span>
                      <button
                        type="button"
                        onClick={() => handleCancelConfirmed(app.id)}
                        className="h-9 px-3.5 rounded-full bg-error-container text-on-error-container hover:opacity-90 transition-opacity font-label-md"
                      >
                        Sí, cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingCancelId(null)}
                        className="h-9 px-3.5 rounded-full bg-surface-container text-on-surface font-label-md"
                      >
                        No
                      </button>
                    </div>
                  )}

                  {isPending && (
                    <>
                      <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm tracking-wide uppercase font-semibold">
                        Pendiente
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app.id, "confirmada")}
                        className="h-9 px-3.5 rounded-full bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app.id, "cancelada")}
                        className="h-9 px-3.5 rounded-full bg-surface-container text-on-surface-variant hover:text-error transition-colors font-label-md"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
