"use client";

/* =====================================================================
   RESERVA FIJA POR SERVICIO (components/admin/ServiceReserveField.tsx)
   ---------------------------------------------------------------------
   Monto que cada servicio aparta para los gastos del negocio
   (arriendo, productos, servicios). Spec F5, tarea 3.27.
   ===================================================================== */

import { useState, useTransition } from "react";
import { updateServiceReserveAction } from "@/lib/actions";
import { formatPrice } from "@/lib/format";

interface ServiceReserveFieldProps {
  serviceId: string;
  serviceName: string;
  initialAmount: number;
}

export default function ServiceReserveField({
  serviceId,
  serviceName,
  initialAmount,
}: ServiceReserveFieldProps) {
  const [saved, setSaved] = useState(initialAmount);
  const [value, setValue] = useState(String(Math.round(initialAmount)));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = `reserve-${serviceId}`;
  const changed = Number(value) !== saved;

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await updateServiceReserveAction(serviceId, Number(value));
      if (res.ok) {
        setSaved(Number(value));
        setMessage({ ok: true, text: "Guardada" });
      } else {
        setMessage({ ok: false, text: res.message || "No se pudo guardar." });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <label htmlFor={inputId} className="font-label-sm text-on-surface-variant">
        Reserva por servicio
      </label>
      <input
        id={inputId}
        type="number"
        min="0"
        step="500"
        inputMode="numeric"
        aria-label={`Reserva para gastos del servicio ${serviceName}`}
        className="w-28 h-9 px-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMessage(null);
        }}
      />
      {changed ? (
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="h-9 px-3 rounded-full bg-primary text-on-primary hover:bg-neutral-800 transition-all font-label-sm disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
      ) : (
        <span className="font-label-sm text-secondary">{formatPrice(saved)}</span>
      )}
      {message && (
        <span
          role={message.ok ? "status" : "alert"}
          className={`font-label-sm ${message.ok ? "text-secondary" : "text-error"}`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
