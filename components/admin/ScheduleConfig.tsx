"use client";

import { useState, useTransition } from "react";
import type { BusinessHours } from "@/lib/types";
import { updateBusinessHoursAction } from "@/lib/actions";
import ErrorMessage from "@/components/ui/ErrorMessage";

interface ScheduleConfigProps {
  initialHours: BusinessHours;
}

export default function ScheduleConfig({ initialHours }: ScheduleConfigProps) {
  const [openDays, setOpenDays] = useState<number[]>(initialHours.open_days);
  const [openTime, setOpenTime] = useState(initialHours.open_time);
  const [closeTime, setCloseTime] = useState(initialHours.close_time);
  const [breakStart, setBreakStart] = useState(initialHours.break_start || "14:00");
  const [breakEnd, setBreakEnd] = useState(initialHours.break_end || "15:00");
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const daysMap = [
    { label: "L", value: 1 },
    { label: "M", value: 2 },
    { label: "X", value: 3 },
    { label: "J", value: 4 },
    { label: "V", value: 5 },
    { label: "S", value: 6 },
    { label: "D", value: 0 },
  ];

  const toggleDay = (dayVal: number) => {
    setOpenDays((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal]
    );
  };

  const handleSave = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await updateBusinessHoursAction({
        open_days: openDays,
        open_time: openTime,
        close_time: closeTime,
        break_start: breakStart,
        break_end: breakEnd,
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setErrorMessage(res.message || "No se pudieron guardar los horarios.");
      }
    });
  };

  return (
    <div className="p-space-lg rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-title-lg text-on-surface">Horario de Atención</h3>
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm font-semibold uppercase">
                Activo
              </span>
            </div>
            <p className="font-body-sm text-on-surface-variant mt-0.5">
              Configuración de turnos semanales y pausas técnicas
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-surface-container font-label-sm text-on-surface">
            {initialHours.barbers_count} barberos
          </span>
        </div>

        {/* Días de apertura */}
        <div className="flex flex-col gap-1.5">
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
            Días de apertura
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {daysMap.map((d) => {
              const isOpen = openDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`w-9 h-9 rounded-full font-label-md transition-all ${
                    isOpen
                      ? "bg-primary text-on-primary shadow-sm font-bold"
                      : "bg-surface-container text-on-surface-variant opacity-60 line-through"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Franjas y Turnos */}
        <div className="flex flex-col gap-2 pt-1">
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
            Configuración de Franjas y Turnos
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-surface-container-low flex flex-col justify-between">
              <span className="font-label-sm text-on-surface-variant">Apertura</span>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="mt-1 font-title-md font-semibold text-on-surface bg-transparent focus:outline-none"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container-low flex flex-col justify-between border-l-2 border-secondary">
              <span className="font-label-sm text-secondary font-semibold">Pausa Almuerzo</span>
              <div className="flex items-center gap-1 mt-1 text-sm font-semibold text-on-surface">
                <input
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  className="bg-transparent w-20 focus:outline-none"
                />
                <span>-</span>
                <input
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  className="bg-transparent w-20 focus:outline-none"
                />
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container-low flex flex-col justify-between">
              <span className="font-label-sm text-on-surface-variant">Cierre</span>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="mt-1 font-title-md font-semibold text-on-surface bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <div className="pt-2 flex flex-col sm:flex-row items-center gap-space-sm">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full flex-1 h-11 px-4 rounded-xl bg-primary text-on-primary hover:bg-primary/85 transition-colors font-label-md flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary-fixed">
            {saved ? "check" : isPending ? "sync" : "save"}
          </span>
          <span>
            {saved
              ? "¡Horarios Guardados!"
              : isPending
              ? "Guardando cambios..."
              : "Guardar Horarios"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => alert("Excepción añadida al calendario.")}
          className="w-full sm:w-auto h-11 px-4 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md flex items-center justify-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">lock_clock</span>
          <span>Añadir Excepción</span>
        </button>
      </div>
    </div>
  );
}
