"use client";

/* =====================================================================
   FILTROS Y CONTROLES DEL REPORTE DE CONTABILIDAD
   (components/accounting/ProfitReportFilters.tsx)
   ===================================================================== */

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  ProfitPeriodInfo,
  ProfitReportFilterOptions,
  ProfitReportFilters as ProfitFiltersType,
  QuickPeriodKey,
} from "@/lib/accounting/profit-report.types";
import { createExpenseAction } from "@/lib/actions";

interface ProfitReportFiltersProps {
  appliedFilters: ProfitFiltersType;
  period: ProfitPeriodInfo;
  filterOptions: ProfitReportFilterOptions;
  /** Botones extra junto a "Registrar gasto" (p. ej. registrar venta de producto, tarea 3.30). */
  extraActions?: React.ReactNode;
}

const QUICK_PERIOD_OPTIONS: { key: QuickPeriodKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "this_week", label: "Esta semana" },
  { key: "this_month", label: "Mes actual" },
  { key: "last_month", label: "Mes anterior" },
];

export default function ProfitReportFilters({
  appliedFilters,
  period,
  filterOptions,
  extraActions,
}: ProfitReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState(appliedFilters.startDate);
  const [endDate, setEndDate] = useState(appliedFilters.endDate);
  const [barberId, setBarberId] = useState(appliedFilters.barberId ?? "");
  const [serviceId, setServiceId] = useState(appliedFilters.serviceId ?? "");
  const [paymentMethod, setPaymentMethod] = useState<string>(
    appliedFilters.paymentMethod ?? ""
  );
  const [paymentStatus, setPaymentStatus] = useState<string>(
    appliedFilters.paymentStatus ?? ""
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(
    appliedFilters.expenseCategoryId ?? ""
  );
  const [clientError, setClientError] = useState<string | null>(null);

  // Modal nativo <dialog> para registrar gasto operativo real
  const expenseDialogRef = useRef<HTMLDialogElement | null>(null);
  const [expenseMessage, setExpenseMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const buildQueryString = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const nextValues: Record<string, string | null> = {
      startDate,
      endDate,
      barberId: barberId || null,
      serviceId: serviceId || null,
      paymentMethod: paymentMethod || null,
      paymentStatus: paymentStatus || null,
      expenseCategoryId: expenseCategoryId || null,
      page: "1",
      ...overrides,
    };

    for (const [key, val] of Object.entries(nextValues)) {
      if (val && val.trim() !== "") {
        params.set(key, val.trim());
      } else {
        params.delete(key);
      }
    }
    return params.toString();
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate > endDate) {
      setClientError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    setClientError(null);
    const qs = buildQueryString({ quickPeriod: "custom" });
    startTransition(() => {
      router.push(`${pathname}?${qs}`);
    });
  };

  const handleSelectQuickPeriod = (quickKey: QuickPeriodKey) => {
    setClientError(null);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("quickPeriod", quickKey);
    params.delete("startDate");
    params.delete("endDate");
    params.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleResetFilters = () => {
    setClientError(null);
    setBarberId("");
    setServiceId("");
    setPaymentMethod("");
    setPaymentStatus("");
    setExpenseCategoryId("");
    startTransition(() => {
      router.push(`${pathname}?quickPeriod=this_month`);
    });
  };

  const exportCsvUrl = `/api/accounting/profit-report?format=csv&${buildQueryString(
    {}
  )}`;

  const openExpenseModal = () => {
    setExpenseMessage(null);
    expenseDialogRef.current?.showModal();
  };

  const closeExpenseModal = () => {
    expenseDialogRef.current?.close();
  };

  const handleExpenseSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createExpenseAction(formData);
      if (res.ok) {
        setExpenseMessage({
          ok: true,
          text: res.message || "Gasto registrado correctamente.",
        });
        router.refresh();
        setTimeout(() => {
          closeExpenseModal();
        }, 700);
      } else {
        setExpenseMessage({
          ok: false,
          text: res.message || "Error al registrar el gasto.",
        });
      }
    });
  };

  return (
    <div className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col gap-5">
      {/* Barra superior: Periodos rápidos + Acciones de exportación y registro de gasto */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-surface-container-high/60">
        <div className="flex flex-col gap-2">
          <span className="font-label-sm uppercase tracking-wider text-on-surface-variant">
            Periodo
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_PERIOD_OPTIONS.map((opt) => {
              const isSelected = appliedFilters.quickPeriod === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSelectQuickPeriod(opt.key)}
                  aria-pressed={isSelected}
                  className={`px-3.5 py-1.5 rounded-full font-label-md transition-all ${
                    isSelected
                      ? "bg-primary text-on-primary shadow-sm font-semibold"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openExpenseModal}
            className="h-10 px-4 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors font-label-md flex items-center gap-1.5"
          >
            <span
              className="material-symbols-outlined text-[18px] text-secondary"
              aria-hidden="true"
            >
              add_card
            </span>
            <span>Registrar gasto</span>
          </button>

          {extraActions}

          <a
            href={exportCsvUrl}
            download
            className="h-10 px-4 rounded-full bg-primary text-on-primary hover:bg-primary/85 transition-colors font-label-md shadow-sm flex items-center gap-1.5"
          >
            <span
              className="material-symbols-outlined text-[18px] text-secondary-fixed"
              aria-hidden="true"
            >
              download
            </span>
            <span>Exportar CSV</span>
          </a>
        </div>
      </div>

      {/* Formulario de filtros detallados */}
      <form onSubmit={handleApplyFilters} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:max-w-md gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-start-date"
              className="font-label-sm text-on-surface-variant uppercase"
            >
              Fecha inicial
            </label>
            <input
              id="filter-start-date"
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-2 focus:outline-secondary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-end-date"
              className="font-label-sm text-on-surface-variant uppercase"
            >
              Fecha final
            </label>
            <input
              id="filter-end-date"
              name="endDate"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm focus:outline-2 focus:outline-secondary"
            />
          </div>

        </div>

        {clientError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-error-container text-on-error-container font-body-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              error
            </span>
            <span>{clientError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="font-body-sm text-on-surface-variant flex flex-wrap items-center gap-2">
            <span>
              <strong>Periodo activo:</strong> {period.startDate} al {period.endDate} ({period.daysCount}{" "}
              {period.daysCount === 1 ? "día" : "días"})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleResetFilters}
              className="h-9 px-4 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors font-label-md"
            >
              Volver al mes actual
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-5 rounded-full bg-secondary text-on-secondary hover:bg-secondary/90 transition-colors font-label-md shadow-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {isPending ? "sync" : "filter_alt"}
              </span>
              <span>{isPending ? "Actualizando..." : "Ver periodo"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Modal nativo <dialog> para registrar nuevo gasto operativo */}
      <dialog
        ref={expenseDialogRef}
        aria-labelledby="new-expense-dialog-title"
        className="m-auto rounded-3xl bg-surface-container-lowest text-on-surface p-6 shadow-2xl border border-surface-container-high w-full max-w-md backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
            <div>
              <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
                Egreso contable
              </span>
              <h2
                id="new-expense-dialog-title"
                className="font-headline-sm text-on-surface font-bold"
              >
                Registrar Gasto Operativo
              </h2>
            </div>
            <button
              type="button"
              onClick={closeExpenseModal}
              aria-label="Cerrar ventana de registro de gasto"
              className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          {expenseMessage && (
            <div
              role="status"
              className={`p-3 rounded-xl text-sm font-medium ${
                expenseMessage.ok
                  ? "bg-secondary-fixed/60 text-on-secondary-fixed"
                  : "bg-error-container text-on-error-container"
              }`}
            >
              {expenseMessage.text}
            </div>
          )}

          <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="exp-date"
                  className="font-label-sm text-on-surface font-medium"
                >
                  Fecha *
                </label>
                <input
                  id="exp-date"
                  name="date"
                  type="date"
                  required
                  defaultValue={period.endDate}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="exp-time"
                  className="font-label-sm text-on-surface font-medium"
                >
                  Hora
                </label>
                <input
                  id="exp-time"
                  name="time"
                  type="time"
                  defaultValue="12:00"
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="exp-category"
                className="font-label-sm text-on-surface font-medium"
              >
                Categoría de gasto *
              </label>
              <select
                id="exp-category"
                name="category"
                required
                defaultValue="servicios_publicos"
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
              >
                {filterOptions.expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="exp-concept"
                className="font-label-sm text-on-surface font-medium"
              >
                Concepto o descripción *
              </label>
              <input
                id="exp-concept"
                name="concept"
                type="text"
                required
                placeholder="Ej. Pago factura energía local"
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="exp-amount"
                  className="font-label-sm text-on-surface font-medium"
                >
                  Importe ({period.currency}) *
                </label>
                <input
                  id="exp-amount"
                  name="amount"
                  type="number"
                  min={1}
                  step="1"
                  required
                  placeholder="45000"
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="exp-method"
                  className="font-label-sm text-on-surface font-medium"
                >
                  Método de pago *
                </label>
                <select
                  id="exp-method"
                  name="payment_method"
                  required
                  defaultValue="transferencia"
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
                >
                  {filterOptions.paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="exp-reference"
                className="font-label-sm text-on-surface font-medium"
              >
                Referencia / Comprobante (opcional)
              </label>
              <input
                id="exp-reference"
                name="reference"
                type="text"
                placeholder="Ej. FAC-2091"
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high/60">
              <button
                type="button"
                onClick={closeExpenseModal}
                className="px-4 py-2 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface font-label-md text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 rounded-full bg-primary text-on-primary hover:bg-primary/85 font-label-md text-sm shadow-sm"
              >
                {isPending ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
