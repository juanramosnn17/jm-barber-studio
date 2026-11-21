"use client";

/* =====================================================================
   REGISTRAR VENTA DE PRODUCTO (components/accounting/ProductSaleDialog.tsx)
   ---------------------------------------------------------------------
   Tarea 3.30 (spec F5): la venta suma a Ingresos y a Tu ganancia y no
   aparta reserva. Solo se muestra con el backend Spring Boot.
   ===================================================================== */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProductSaleAction } from "@/lib/actions";
import type { PaymentMethod } from "@/lib/types";

interface ProductSaleDialogProps {
  defaultDate: string;
  paymentMethods: { id: PaymentMethod; label: string }[];
}

const fieldClass =
  "h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm";
const labelClass = "font-label-sm text-on-surface font-medium";

export default function ProductSaleDialog({ defaultDate, paymentMethods }: ProductSaleDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = () => {
    setMessage(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const res = await createProductSaleAction(formData);
      setMessage({ ok: res.ok, text: res.message || (res.ok ? "Venta registrada." : "No se pudo registrar la venta.") });
      if (res.ok) {
        form.reset();
        router.refresh();
        setTimeout(close, 700);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="h-10 px-4 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors font-label-md flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">
          sell
        </span>
        <span>Registrar venta</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="new-sale-dialog-title"
        className="m-auto rounded-3xl bg-surface-container-lowest text-on-surface p-6 shadow-2xl border border-surface-container-high w-full max-w-md backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
            <div>
              <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">Ingreso</span>
              <h2 id="new-sale-dialog-title" className="font-headline-sm text-on-surface font-bold">
                Registrar venta de producto
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar ventana de registro de venta"
              className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          {message && (
            <div
              role="status"
              className={`p-3 rounded-xl text-sm font-medium ${
                message.ok ? "bg-secondary-fixed/60 text-on-secondary-fixed" : "bg-error-container text-on-error-container"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="sale-date" className={labelClass}>Fecha *</label>
                <input id="sale-date" name="date" type="date" required defaultValue={defaultDate} className={fieldClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="sale-time" className={labelClass}>Hora</label>
                <input id="sale-time" name="time" type="time" defaultValue="12:00" className={fieldClass} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="sale-concept" className={labelClass}>Producto *</label>
              <input
                id="sale-concept"
                name="concept"
                type="text"
                required
                maxLength={200}
                placeholder="Ej. Cera para cabello"
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="sale-amount" className={labelClass}>Importe (COP) *</label>
                <input
                  id="sale-amount"
                  name="amount"
                  type="number"
                  min={1}
                  step="1"
                  required
                  placeholder="18000"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="sale-method" className={labelClass}>Método de pago *</label>
                <select id="sale-method" name="payment_method" required defaultValue="efectivo" className={fieldClass}>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="font-body-sm text-on-surface-variant">
              La venta suma a Ingresos y a Tu ganancia. No aparta reserva.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high/60">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface font-label-md text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 rounded-full bg-primary text-on-primary hover:bg-primary/85 font-label-md text-sm shadow-sm"
              >
                {isPending ? "Guardando..." : "Guardar venta"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
