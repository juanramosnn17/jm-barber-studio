"use client";

/* =====================================================================
   AJUSTES CONTABLES DEL COMPROBANTE
   (components/accounting/AccountingAdjustments.tsx)
   ---------------------------------------------------------------------
   Acciones del admin sobre un movimiento (spec F5, tareas 3.23–3.26, 3.29 y 3.30):
     - Gasto registrado: Editar · Anular (con motivo) · Eliminar
     - Gasto anulado:    Eliminar (muestra motivo y fecha de anulación)
     - Venta de producto: Anular (con motivo) · Eliminar (solo con la API)
     - Cita completada:  Ajustar pago (método, descuento, reembolso y, con la API, propina)
   ===================================================================== */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adjustAppointmentPaymentAction,
  deleteExpenseAction,
  deleteProductSaleAction,
  updateExpenseAction,
  voidExpenseAction,
  voidProductSaleAction,
} from "@/lib/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/accounting/profit-report.validation";
import type { AccountingTransactionRow } from "@/lib/accounting/profit-report.types";
import type { ExpenseCategory, PaymentMethod } from "@/lib/types";
import ErrorMessage from "@/components/ui/ErrorMessage";

type Mode = "menu" | "edit" | "void" | "delete" | "payment";

interface AccountingAdjustmentsProps {
  row: AccountingTransactionRow;
  /** Se llama cuando un ajuste se guardó, para cerrar el comprobante. */
  onDone: () => void;
  /** Categorías que acepta el backend activo (Supabase no tiene la de compras, 3.29). */
  expenseCategories: { id: ExpenseCategory; label: string }[];
  /** true con la API Spring Boot: muestra la propina en el ajuste de pago (3.29). */
  apiMode: boolean;
}

const inputClass =
  "w-full h-11 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-secondary/40";
const labelClass = "font-label-sm text-on-surface-variant uppercase";
const primaryBtn =
  "h-11 px-5 rounded-full bg-primary text-on-primary hover:bg-neutral-800 transition-all font-label-md disabled:opacity-50";
const secondaryBtn =
  "h-11 px-5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md disabled:opacity-50";
const dangerBtn =
  "h-11 px-5 rounded-full bg-error-container text-on-error-container hover:opacity-90 transition-opacity font-label-md disabled:opacity-50";

export default function AccountingAdjustments({
  row,
  onDone,
  expenseCategories,
  apiMode,
}: AccountingAdjustmentsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("menu");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Formulario de edición de gasto
  const [date, setDate] = useState(row.date);
  const [time, setTime] = useState(row.time);
  const [category, setCategory] = useState<ExpenseCategory>(
    (row.expenseCategory as ExpenseCategory) ?? "otros"
  );
  const [concept, setConcept] = useState(row.concept);
  const [amount, setAmount] = useState(String(Math.round(Number(row.expenseAmount ?? 0))));
  const [method, setMethod] = useState<PaymentMethod>(row.paymentMethod ?? "efectivo");
  const [reference, setReference] = useState(row.expenseReference ?? "");

  // Anulación y ajuste de pago
  const [reason, setReason] = useState("");
  const [discount, setDiscount] = useState(String(Math.round(Number(row.discountAmount))));
  const [refund, setRefund] = useState(String(Math.round(Number(row.refundAmount))));
  const [tip, setTip] = useState(String(Math.round(Number(row.tipAmount))));

  const isExpense = row.source === "expense";
  const isSale = row.source === "product_sale";
  const noun = isSale ? "venta" : "gasto";
  const isVoided = (isExpense || isSale) && row.status === "anulado";
  const isCompletedAppointment =
    row.source === "appointment" && row.appointmentStatus === "completada";

  if (!isExpense && !isSale && !isCompletedAppointment) return null;

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        router.refresh();
        onDone();
      } else {
        setError(res.message || "No se pudo guardar el cambio.");
      }
    });
  };

  const back = () => {
    setError(null);
    setMode("menu");
  };

  return (
    <div className="flex flex-col gap-3 border-t border-surface-container-high/60 pt-4">
      <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
        Ajustes contables
      </span>

      {isVoided && (
        <p className="p-3 rounded-xl bg-surface-container-low text-sm text-on-surface">
          <span className="font-semibold">Anulado</span>
          {row.voidedAt ? ` el ${row.voidedAt.slice(0, 10)}` : ""}.{" "}
          Motivo: {row.voidReason || "sin motivo registrado"}
        </p>
      )}

      {error && <ErrorMessage message={error} />}

      {mode === "menu" && (
        <div className="flex flex-wrap gap-2">
          {isExpense && !isVoided && (
            <button type="button" className={secondaryBtn} onClick={() => setMode("edit")}>
              Editar
            </button>
          )}
          {(isExpense || isSale) && !isVoided && (
            <button type="button" className={secondaryBtn} onClick={() => setMode("void")}>
              Anular
            </button>
          )}
          {(isExpense || isSale) && (
            <button type="button" className={dangerBtn} onClick={() => setMode("delete")}>
              Eliminar
            </button>
          )}
          {isCompletedAppointment && (
            <button type="button" className={secondaryBtn} onClick={() => setMode("payment")}>
              Ajustar pago
            </button>
          )}
        </div>
      )}

      {mode === "edit" && (
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              updateExpenseAction(row.relatedId, {
                date,
                time,
                category,
                concept,
                amount: Number(amount),
                payment_method: method,
                reference,
              })
            );
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="adj-date" className={labelClass}>Fecha</label>
            <input id="adj-date" type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="adj-time" className={labelClass}>Hora</label>
            <input id="adj-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label htmlFor="adj-category" className={labelClass}>Categoría</label>
            <select id="adj-category" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {expenseCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label htmlFor="adj-concept" className={labelClass}>Concepto</label>
            <input id="adj-concept" required className={inputClass} value={concept} onChange={(e) => setConcept(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="adj-amount" className={labelClass}>Monto (COP)</label>
            <input id="adj-amount" type="number" min="1" step="1" required className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="adj-method" className={labelClass}>Método de pago</label>
            <select id="adj-method" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label htmlFor="adj-reference" className={labelClass}>Referencia (opcional)</label>
            <input id="adj-reference" className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={back} disabled={isPending}>Volver</button>
            <button type="submit" className={primaryBtn} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}

      {mode === "void" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              isSale ? voidProductSaleAction(row.relatedId, reason) : voidExpenseAction(row.relatedId, reason)
            );
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="adj-reason" className={labelClass}>Motivo de la anulación</label>
            <textarea
              id="adj-reason"
              required
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-secondary/40"
              placeholder={isSale ? "Ej.: venta registrada por error" : "Ej.: gasto registrado por error"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <p className="font-body-sm text-on-surface-variant">
            {isSale ? "La venta quedará visible como \"Anulada\"" : "El gasto quedará visible como \"Anulado\""} y
            dejará de sumar en los totales.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={back} disabled={isPending}>Volver</button>
            <button type="submit" className={primaryBtn} disabled={isPending}>
              {isPending ? "Anulando..." : `Anular ${noun}`}
            </button>
          </div>
        </form>
      )}

      {mode === "delete" && (
        <div className="flex flex-col gap-3">
          <p className="p-3 rounded-xl bg-error-container text-on-error-container text-sm">
            <span className="font-semibold">¿Eliminar definitivamente {isSale ? "esta venta" : "este gasto"}?</span> Se
            borrará sin dejar rastro y no se puede deshacer. Para corregir {isSale ? "una venta real" : "un gasto real"} es
            mejor <span className="font-semibold">{isSale ? "anularla" : "anularlo"}</span>.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={back} disabled={isPending}>Volver</button>
            <button
              type="button"
              className={dangerBtn}
              disabled={isPending}
              onClick={() =>
                run(() => (isSale ? deleteProductSaleAction(row.relatedId) : deleteExpenseAction(row.relatedId)))
              }
            >
              {isPending ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </div>
        </div>
      )}

      {mode === "payment" && (
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              adjustAppointmentPaymentAction(row.relatedId, {
                payment_method: method,
                discount_amount: Number(discount),
                refund_amount: Number(refund),
                ...(apiMode ? { tip_amount: Number(tip) } : {}),
              })
            );
          }}
        >
          <div className="flex flex-col gap-1 col-span-2">
            <label htmlFor="adj-pay-method" className={labelClass}>Método de pago</label>
            <select id="adj-pay-method" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="adj-discount" className={labelClass}>Descuento (COP)</label>
            <input id="adj-discount" type="number" min="0" step="1" className={inputClass} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="adj-refund" className={labelClass}>Reembolso (COP)</label>
            <input id="adj-refund" type="number" min="0" step="1" className={inputClass} value={refund} onChange={(e) => setRefund(e.target.value)} />
          </div>
          {apiMode && (
            <div className="flex flex-col gap-1 col-span-2">
              <label htmlFor="adj-tip" className={labelClass}>Propina (COP)</label>
              <input id="adj-tip" type="number" min="0" step="1" className={inputClass} value={tip} onChange={(e) => setTip(e.target.value)} />
            </div>
          )}
          <p className="col-span-2 font-body-sm text-on-surface-variant">
            Ingreso neto = precio del servicio − descuento − reembolso.
            {apiMode && " La propina va aparte: no suma a Ingresos ni a la Reserva."}
          </p>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={back} disabled={isPending}>Volver</button>
            <button type="submit" className={primaryBtn} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar ajuste"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
