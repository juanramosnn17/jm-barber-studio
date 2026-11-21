"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import type { BusinessHours, Service } from "@/lib/types";
import { formatFullDate, formatPrice, minutesToTime, timeToMinutes, toISODate } from "@/lib/format";
import { generateDailySlots, isOpenOn, type BookedRange } from "@/lib/schedule";
import { getBookedRangesByDate } from "@/lib/data/public-actions";
import { createAppointmentAction } from "@/lib/actions";

interface BookingWizardProps {
  services: Service[];
  businessHours: BusinessHours;
  initialServiceId?: string;
}

export default function BookingWizard({
  services,
  businessHours,
  initialServiceId,
}: BookingWizardProps) {
  // Preseleccionar según ID o el primero
  const initialService =
    (initialServiceId && services.find((s) => s.id === initialServiceId)) ||
    services[0] ||
    null;

  const [selectedService, setSelectedService] = useState<Service | null>(initialService);

  // Fecha seleccionada (por defecto hoy)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  // Fecha cuyas horas ocupadas ya se cargaron (la carga se deduce de esto, sin setState en el efecto)
  const [slotsLoadedFor, setSlotsLoadedFor] = useState<string | null>(null);
  // Horario que el cliente tocó; el horario efectivo se calcula más abajo
  const [pickedSlot, setPickedSlot] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: string;
    serviceName: string;
    date: string;
    time: string;
    price: number;
    duration: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDateISO = toISODate(selectedDate);

  // Consultar los rangos ocupados (por cualquier cliente, sin sus datos) de la fecha
  // seleccionada para evitar cruces de citas (tarea 4.12; con Supabase, get_booked_slots).
  useEffect(() => {
    let active = true;

    getBookedRangesByDate(selectedDateISO)
      .then((occupied) => {
        if (!active) return;
        setBookedRanges(occupied);
        setSlotsLoadedFor(selectedDateISO);
      })
      .catch(() => {
        if (!active) return;
        setBookedRanges([]);
        setSlotsLoadedFor(selectedDateISO);
      });

    return () => {
      active = false;
    };
  }, [selectedDateISO]);

  const isLoadingSlots = slotsLoadedFor !== selectedDateISO;

  // Horas donde el servicio elegido cabe completo, sin cruzar otras citas ni el descanso
  const availableSlots = generateDailySlots(
    businessHours,
    bookedRanges,
    selectedDateISO,
    selectedService?.duration_minutes
  );
  const isOpen = isOpenOn(selectedDate, businessHours);

  // Horario efectivo: el que tocó el cliente si sigue disponible; si no, el primero libre
  const selectedSlot = availableSlots.includes(pickedSlot)
    ? pickedSlot
    : (availableSlots[0] ?? "");

  // Generar días del mes actual para el calendario interactivo
  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Lunes = 0

  const handleDaySelect = (day: number) => {
    const nextDate = new Date(currentYear, currentMonth, day);
    setSelectedDate(nextDate);
    setStatusMessage(null);
  };

  const handleBookingConfirm = () => {
    if (!selectedService || !selectedSlot) return;
    setStatusMessage(null);
    startTransition(async () => {
      const res = await createAppointmentAction(
        selectedService.id,
        selectedDateISO,
        selectedSlot
      );
      if (res.ok) {
        // Actualización optimista: el rango recién reservado deja de ofrecerse
        const start = timeToMinutes(selectedSlot);
        setBookedRanges((prev) => [
          ...prev,
          { start: selectedSlot, end: minutesToTime(start + selectedService.duration_minutes) },
        ]);
        setConfirmedBooking({
          id: res.appointmentId || `JM-${Date.now().toString().slice(-6)}`,
          serviceName: selectedService.name,
          date: selectedDateISO,
          time: selectedSlot,
          price: selectedService.price,
          duration: selectedService.duration_label,
        });
      } else {
        setStatusMessage({ ok: false, text: res.message || "No se pudo reservar la cita." });
      }
    });
  };

  // VISTA DE CONFIRMACIÓN DE CITA
  if (confirmedBooking) {
    return (
      <section className="p-space-lg lg:p-space-xl rounded-3xl bg-surface-container-low shadow-md flex flex-col items-center text-center gap-space-lg border border-secondary/30" id="booking-flow">
        <div className="w-20 h-20 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-on-secondary-fixed mb-2 shadow-inner">
          <span className="material-symbols-outlined text-[48px] text-secondary">
            check_circle
          </span>
        </div>

        <div className="max-w-xl">
          <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
            ¡Reserva Confirmada con Éxito!
          </span>
          <h2 className="font-headline-lg text-on-surface font-bold mt-1">
            Tu cita en JM Barber Studio está agendada
          </h2>
          <p className="font-body-md text-on-surface-variant mt-2">
            Hemos registrado tu turno en nuestra agenda. Tu sillón estará listo y esperándote a la hora reservada.
          </p>
        </div>

        {/* Tarjeta de Detalles del Turno */}
        <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container-high/60 flex flex-col gap-4 text-left">
          <div className="flex justify-between items-center pb-3 border-b border-surface-container-high/60">
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">
              Código de Reserva
            </span>
            <span className="font-mono text-sm font-bold text-secondary px-2.5 py-1 rounded bg-surface-container">
              #{confirmedBooking.id.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-label-xs text-on-surface-variant uppercase">Servicio</span>
              <p className="font-title-md font-bold text-on-surface">{confirmedBooking.serviceName}</p>
              <span className="font-body-xs text-secondary">{confirmedBooking.duration}</span>
            </div>
            <div>
              <span className="font-label-xs text-on-surface-variant uppercase">Inversión</span>
              <p className="font-title-md font-bold text-secondary">{formatPrice(confirmedBooking.price)}</p>
              <span className="font-body-xs text-on-surface-variant">Pago en el estudio</span>
            </div>
            <div>
              <span className="font-label-xs text-on-surface-variant uppercase">Fecha</span>
              <p className="font-title-md font-bold text-on-surface">{formatFullDate(confirmedBooking.date)}</p>
            </div>
            <div>
              <span className="font-label-xs text-on-surface-variant uppercase">Hora</span>
              <p className="font-title-md font-bold text-on-surface">{confirmedBooking.time}</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2 mt-2">
            <span className="material-symbols-outlined text-[20px] text-secondary shrink-0">
              info
            </span>
            <span>Te recomendamos llegar 5 minutos antes.</span>
          </div>
        </div>

        {/* Botones de Acción Post-Confirmación */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => {
              setConfirmedBooking(null);
              setStatusMessage(null);
            }}
            className="px-6 py-3 rounded-full bg-primary text-on-primary font-label-md hover:bg-neutral-800 transition-colors shadow-sm"
          >
            Reservar otra cita
          </button>
          <a
            href="/cliente"
            className="px-6 py-3 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md transition-colors"
          >
            Ver mis citas
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="p-space-lg lg:p-space-xl rounded-3xl bg-surface-container-low shadow-sm flex flex-col gap-space-xl" id="booking-flow">
      {/* Encabezado del Flujo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm border-b border-surface-container-high/60 pb-space-md">
        <div>
          <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
            Reserva Guiada
          </span>
          <h2 className="font-headline-lg text-on-surface">Reserva en sencillos pasos</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-label-md text-on-surface-variant font-medium">Paso 3 de 4</span>
          <div className="w-28 h-2 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="w-3/4 h-full bg-primary rounded-full transition-all duration-300"></div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 ${
            statusMessage.ok
              ? "bg-secondary-fixed/40 text-on-secondary-fixed border border-secondary"
              : "bg-error-container text-on-error-container"
          }`}
        >
          <span className="material-symbols-outlined">
            {statusMessage.ok ? "check_circle" : "error"}
          </span>
          <span className="font-label-lg font-semibold">{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Pasos 1, 2 y 3 (Columna Izquierda 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-space-xl">
          {/* PASO 1: Selección de Servicio */}
          <div className="flex flex-col gap-space-md">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-label-sm flex items-center justify-center font-bold">
                1
              </span>
              <h3 className="font-title-lg text-on-surface font-semibold">
                Selecciona tu servicio
              </h3>
            </div>

            {/* Chips de Servicios */}
            <div className="flex flex-wrap gap-2 pt-1">
              {services.map((service) => {
                const isSelected = selectedService?.id === service.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedService(service)}
                    className={`px-4 py-2.5 rounded-full font-label-md flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? "bg-primary text-on-primary shadow-sm ring-2 ring-secondary/40 font-semibold"
                        : "bg-surface-container-lowest text-on-surface hover:bg-surface-container border border-outline-variant/30"
                    }`}
                  >
                    {isSelected && (
                      <span className="material-symbols-outlined text-secondary-fixed-dim text-[16px]">
                        star
                      </span>
                    )}
                    <span>{service.short_name}</span>
                  </button>
                );
              })}
            </div>

            {/* Card Dinámica del Servicio Seleccionado */}
            {selectedService && (
              <div className="mt-space-xs p-space-md sm:p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm border border-surface-variant flex flex-col md:flex-row gap-space-md items-stretch">
                <div className="w-full md:w-52 h-44 md:h-auto rounded-xl overflow-hidden shrink-0 bg-surface-container relative">
                  {selectedService.image_url ? (
                    <Image
                      src={selectedService.image_url}
                      alt={selectedService.name}
                      fill
                      className="object-cover transition-opacity duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-high">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                        {selectedService.icon}
                      </span>
                    </div>
                  )}
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full font-label-sm bg-primary/85 text-on-primary backdrop-blur-sm uppercase font-bold tracking-wider">
                    Seleccionado
                  </span>
                </div>

                <div className="flex flex-col justify-between flex-1 gap-space-sm">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-headline-sm text-on-surface font-bold">
                        {selectedService.name}
                      </h4>
                      <span className="font-headline-sm text-secondary font-bold">
                        {formatPrice(selectedService.price)}
                      </span>
                    </div>
                    <p className="font-body-sm text-on-surface-variant">
                      {selectedService.description}
                    </p>
                  </div>

                  <div className="pt-space-xs border-t border-surface-variant flex flex-wrap items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-space-md text-on-surface-variant font-body-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-secondary">
                          schedule
                        </span>
                        <span>{selectedService.duration_label}</span>
                      </span>
                      {selectedService.includes && (
                        <span className="hidden sm:flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px] text-secondary">
                            check_circle
                          </span>
                          <span className="truncate">{selectedService.includes}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PASO 2: Calendario Visual */}
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-label-sm flex items-center justify-center font-bold">
                  2
                </span>
                <h3 className="font-title-lg text-on-surface font-semibold">Selecciona una fecha</h3>
              </div>
              <span className="font-label-md text-on-surface-variant font-medium">
                {selectedDate.toLocaleDateString("es-CO", { month: "long", year: "numeric" }).toUpperCase()}
              </span>
            </div>

            <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-2">
              <div className="grid grid-cols-7 text-center font-label-sm text-on-surface-variant py-1 font-semibold">
                <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center font-body-sm">
                {/* Espacios vacíos antes del día 1 */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <span key={`empty-${i}`} className="py-2.5 opacity-20 pointer-events-none">
                    •
                  </span>
                ))}
                {/* Días del mes */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isSelected = selectedDate.getDate() === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDaySelect(day)}
                      className={`py-2.5 rounded-xl transition-all ${
                        isSelected
                          ? "bg-primary text-on-primary font-semibold shadow-sm ring-2 ring-secondary/40"
                          : "hover:bg-surface-container text-on-surface"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PASO 3: Horarios Disponibles */}
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary font-label-sm flex items-center justify-center font-bold">
                  3
                </span>
                <h3 className="font-title-lg text-on-surface font-semibold">
                  Horarios disponibles ({formatFullDate(selectedDateISO)})
                </h3>
              </div>
              {isLoadingSlots && (
                <span className="font-label-sm text-on-surface-variant animate-pulse">
                  Verificando disponibilidad...
                </span>
              )}
            </div>

            {!isOpen ? (
              <p className="p-4 rounded-xl bg-surface-container text-on-surface-variant text-body-sm">
                El estudio se encuentra cerrado los días seleccionados. Por favor escoge otro día.
              </p>
            ) : availableSlots.length === 0 ? (
              <p className="p-4 rounded-xl bg-surface-container text-on-surface-variant text-body-sm">
                Todos los horarios para esta fecha ya se encuentran reservados. Por favor selecciona otro día.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-1">
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setPickedSlot(slot)}
                      className={`py-2.5 px-3 rounded-xl font-label-md text-center transition-all border ${
                        isSelected
                          ? "bg-primary text-on-primary shadow-sm flex items-center justify-center gap-1.5 ring-2 ring-secondary font-semibold border-primary"
                          : "bg-surface-container-lowest text-on-surface hover:bg-surface-container border-outline-variant/30"
                      }`}
                    >
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim"></span>
                      )}
                      <span>{slot}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PASO 4: Resumen & Confirmación (Columna Derecha 4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between p-space-lg rounded-2xl bg-surface-container-lowest shadow-md h-fit">
          <div className="flex flex-col gap-space-md">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-secondary text-on-secondary font-label-sm flex items-center justify-center font-bold">
                4
              </span>
              <h3 className="font-title-lg text-on-surface font-semibold">Resumen de cita</h3>
            </div>

            <div className="flex flex-col gap-space-sm pt-space-xs">
              <div className="flex justify-between items-center py-2 border-b border-surface-variant/40">
                <span className="font-body-sm text-on-surface-variant">Servicio</span>
                <span className="font-title-md text-on-surface text-right font-medium">
                  {selectedService?.name || "Sin seleccionar"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-surface-variant/40">
                <span className="font-body-sm text-on-surface-variant">Fecha</span>
                <span className="font-title-md text-on-surface">
                  {formatFullDate(selectedDateISO)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-surface-variant/40">
                <span className="font-body-sm text-on-surface-variant">Hora de reserva</span>
                <span className="font-title-md text-on-surface">{selectedSlot || "Sin horario"}</span>
              </div>
              {/* Duración del servicio y hora en que termina (spec F2, tarea 4.14) */}
              <div className="flex justify-between items-center py-2 border-b border-surface-variant/40">
                <span className="font-body-sm text-on-surface-variant">Duración</span>
                <span className="font-title-md text-on-surface text-right">
                  {selectedService ? `${selectedService.duration_minutes} min` : "—"}
                  {selectedService && selectedSlot
                    ? ` · hasta ${minutesToTime(timeToMinutes(selectedSlot) + selectedService.duration_minutes)}`
                    : ""}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 bg-surface-container-low px-space-md rounded-xl mt-space-xs">
                <span className="font-title-md text-on-surface font-semibold">Total estimado</span>
                <span className="font-headline-sm text-secondary font-bold">
                  {selectedService ? formatPrice(selectedService.price) : "$ 0"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-space-lg flex flex-col gap-space-xs">
            <button
              type="button"
              onClick={handleBookingConfirm}
              disabled={isPending || isLoadingSlots || !selectedService || !isOpen || !selectedSlot}
              className="w-full py-3.5 rounded-full bg-secondary text-on-secondary hover:bg-secondary/90 shadow-md font-label-lg uppercase tracking-wider font-bold transition-all text-center disabled:opacity-50"
            >
              {isPending ? "Confirmando..." : "Confirmar reserva"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
