"use client";

/* =====================================================================
   TABLA DETALLADA Y AUDITABLE DE MOVIMIENTOS CONTABLES
   (components/accounting/AccountingTransactionsTable.tsx)
   ===================================================================== */

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import type {
  AccountingTransactionRow,
  PaginatedTransactions,
  ProfitSummary,
  SortDirection,
  TransactionSortField,
} from "@/lib/accounting/profit-report.types";

interface AccountingTransactionsTableProps {
  transactions: PaginatedTransactions;
  summary: ProfitSummary;
  currency: string;
}

const SORT_OPTIONS: { value: TransactionSortField; label: string }[] = [
  { value: "dateTime", label: "Fecha y hora" },
  { value: "type", label: "Tipo de movimiento" },
  { value: "concept", label: "Concepto" },
  { value: "incomeAmount", label: "Ingreso neto" },
  { value: "expenseAmount", label: "Egreso / Costo" },
  { value: "status", label: "Estado" },
];

export default function AccountingTransactionsTable({
  transactions,
  summary,
  currency,
}: AccountingTransactionsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const detailDialogRef = useRef<HTMLDialogElement | null>(null);
  const [selectedRow, setSelectedRow] =
    useState<AccountingTransactionRow | null>(null);

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(updates)) {
      params.set(k, v);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handlePageChange = (nextPage: number) => {
    const safe = Math.max(1, Math.min(transactions.totalPages, nextPage));
    updateParams({ page: String(safe) });
  };

  const handleSortFieldChange = (field: TransactionSortField) => {
    updateParams({ sortBy: field, page: "1" });
  };

  const handleSortOrderChange = (order: SortDirection) => {
    updateParams({ sortOrder: order, page: "1" });
  };

  const openDetailModal = (row: AccountingTransactionRow) => {
    setSelectedRow(row);
    detailDialogRef.current?.showModal();
  };

  const closeDetailModal = () => {
    detailDialogRef.current?.close();
  };

  const totalOutflowsGlobal =
    Number(summary.directCosts) + Number(summary.operatingExpenses);

  return (
    <section
      aria-labelledby="transactions-audit-heading"
      className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col overflow-hidden"
    >
      {/* Cabecera y controles de ordenamiento seguro */}
      <div className="p-6 border-b border-surface-container-high/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
            Auditoría de Operaciones
          </span>
          <h2
            id="transactions-audit-heading"
            className="font-title-lg text-on-surface font-bold"
          >
            Detalle de Movimientos del Periodo ({transactions.total} registros)
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Los totales al pie corresponden a todo el conjunto filtrado en el servidor, no solo a la página visible.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="sort-by-select"
              className="font-label-sm text-on-surface-variant uppercase"
            >
              Ordenar por:
            </label>
            <select
              id="sort-by-select"
              disabled={isPending}
              value={transactions.sortBy}
              onChange={(e) =>
                handleSortFieldChange(e.target.value as TransactionSortField)
              }
              className="h-9 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-xs"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="sort-order-select"
              className="font-label-sm text-on-surface-variant uppercase"
            >
              Dirección:
            </label>
            <select
              id="sort-order-select"
              disabled={isPending}
              value={transactions.sortOrder}
              onChange={(e) =>
                handleSortOrderChange(e.target.value as SortDirection)
              }
              className="h-9 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-xs"
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla auditable con contenedor enfocable y encabezados sticky */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="accounting-transactions-caption"
        className="overflow-x-auto max-h-[540px]"
      >
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <caption id="accounting-transactions-caption" className="sr-only">
            Movimientos contables detallados con ingresos, egresos, método de pago y estado
          </caption>
          <thead className="sticky top-0 z-10 bg-surface-container-low text-on-surface-variant font-label-sm uppercase border-b border-surface-container-high/60">
            <tr>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                Fecha y Hora
              </th>
              <th scope="col" className="py-3.5 px-3">
                Tipo
              </th>
              <th scope="col" className="py-3.5 px-3">
                Referencia
              </th>
              <th scope="col" className="py-3.5 px-3">
                Concepto
              </th>
              <th scope="col" className="py-3.5 px-3">
                Cliente
              </th>
              <th scope="col" className="py-3.5 px-3">
                Barbero
              </th>
              <th scope="col" className="py-3.5 px-3">
                Método Pago
              </th>
              <th scope="col" className="py-3.5 px-3 text-right">
                Ingreso Neto
              </th>
              <th scope="col" className="py-3.5 px-3 text-right">
                Costo / Egreso
              </th>
              <th scope="col" className="py-3.5 px-3">
                Estado
              </th>
              <th scope="col" className="py-3.5 px-4 text-right">
                Detalle
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-container-low">
            {transactions.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="py-10 px-6 text-center text-on-surface-variant font-body-md"
                >
                  No existen movimientos registrados para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              transactions.rows.map((row) => {
                const outflow =
                  Number(row.directCostAmount) +
                  Number(row.operatingExpenseAmount);

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-surface-container-low/40 transition-colors ${
                      !row.isCountedInTotals ? "opacity-65" : ""
                    }`}
                  >
                    <th
                      scope="row"
                      className="py-3.5 px-4 font-mono text-xs whitespace-nowrap font-semibold text-on-surface"
                    >
                      {row.dateTime}
                    </th>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          row.type === "ingreso_servicio"
                            ? "bg-secondary-fixed/70 text-on-secondary-fixed"
                            : row.type === "reembolso_servicio"
                            ? "bg-amber-100 text-amber-950"
                            : row.type === "gasto_operativo"
                            ? "bg-surface-container-highest text-on-surface"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                      {row.reference}
                    </td>
                    <td className="py-3.5 px-3 font-medium text-on-surface">
                      {row.concept}
                    </td>
                    <td className="py-3.5 px-3 text-on-surface-variant whitespace-nowrap">
                      {row.clientAnonymized ?? "—"}
                    </td>
                    <td className="py-3.5 px-3 text-on-surface-variant whitespace-nowrap">
                      {row.barberName ?? "—"}
                    </td>
                    <td className="py-3.5 px-3 text-on-surface-variant whitespace-nowrap">
                      {row.paymentMethodLabel}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-on-surface whitespace-nowrap">
                      {Number(row.netIncome) !== 0
                        ? formatAccountingCurrency(row.netIncome, currency)
                        : "—"}
                    </td>
                    <td className="py-3.5 px-3 text-right font-medium text-on-surface-variant whitespace-nowrap">
                      {outflow > 0
                        ? formatAccountingCurrency(outflow, currency)
                        : "—"}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="text-xs font-medium text-on-surface-variant">
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openDetailModal(row)}
                        aria-label={`Ver detalle del movimiento ${row.reference}`}
                        className="px-3 py-1 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold transition-colors"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Totales globales calculados sobre TODO el conjunto filtrado */}
          <tfoot className="bg-surface-container-low/90 border-t-2 border-surface-container-high font-semibold text-on-surface">
            <tr>
              <th
                scope="row"
                colSpan={7}
                className="py-3.5 px-4 text-left uppercase text-xs tracking-wider"
              >
                Totales globales del conjunto filtrado ({summary.paidServicesCount}{" "}
                servicios pagados)
              </th>
              <td className="py-3.5 px-3 text-right whitespace-nowrap">
                {formatAccountingCurrency(summary.netRevenue, currency)}
              </td>
              <td className="py-3.5 px-3 text-right whitespace-nowrap">
                {formatAccountingCurrency(totalOutflowsGlobal, currency)}
              </td>
              <td colSpan={2} className="py-3.5 px-4 text-right whitespace-nowrap">
                Neto:{" "}
                {formatAccountingCurrency(
                  summary.netProfit ?? summary.partialNetProfit,
                  currency
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Paginación en servidor */}
      <div className="p-4 bg-surface-container-low/50 border-t border-surface-container-high/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
        <span>
          Mostrando {transactions.rows.length} de {transactions.total} movimientos
          (Página {transactions.page} de {transactions.totalPages})
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isPending || transactions.page <= 1}
            onClick={() => handlePageChange(transactions.page - 1)}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 font-semibold"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-semibold">
            {transactions.page} / {transactions.totalPages}
          </span>
          <button
            type="button"
            disabled={isPending || transactions.page >= transactions.totalPages}
            onClick={() => handlePageChange(transactions.page + 1)}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 font-semibold"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal nativo <dialog> de auditoría individual */}
      <dialog
        ref={detailDialogRef}
        aria-labelledby="movement-detail-title"
        className="m-auto rounded-3xl bg-surface-container-lowest text-on-surface p-6 shadow-2xl border border-surface-container-high w-full max-w-lg backdrop:bg-black/60"
      >
        {selectedRow && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-3">
              <div>
                <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
                  Comprobante Auditable
                </span>
                <h3
                  id="movement-detail-title"
                  className="font-headline-sm text-on-surface font-bold"
                >
                  {selectedRow.reference}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                aria-label="Cerrar detalle del movimiento"
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Fecha y Hora
                </dt>
                <dd className="font-semibold mt-0.5">{selectedRow.dateTime}</dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Tipo de Movimiento
                </dt>
                <dd className="font-semibold mt-0.5">{selectedRow.typeLabel}</dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low col-span-2">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Concepto
                </dt>
                <dd className="font-semibold mt-0.5">{selectedRow.concept}</dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Cliente (Anonimizado)
                </dt>
                <dd className="font-semibold mt-0.5">
                  {selectedRow.clientAnonymized ?? "No aplica"}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Barbero Asignado
                </dt>
                <dd className="font-semibold mt-0.5">
                  {selectedRow.barberName ?? "No aplica"}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Ingreso Bruto
                </dt>
                <dd className="font-semibold mt-0.5">
                  {formatAccountingCurrency(selectedRow.grossIncome, currency)}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Descuento / Reembolso
                </dt>
                <dd className="font-semibold mt-0.5">
                  -{formatAccountingCurrency(selectedRow.discountAmount, currency)}{" "}
                  / -{formatAccountingCurrency(selectedRow.refundAmount, currency)}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Ingreso Neto
                </dt>
                <dd className="font-semibold mt-0.5">
                  {formatAccountingCurrency(selectedRow.netIncome, currency)}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Costo Directo / Gasto Operativo
                </dt>
                <dd className="font-semibold mt-0.5">
                  {formatAccountingCurrency(
                    Number(selectedRow.directCostAmount) +
                      Number(selectedRow.operatingExpenseAmount),
                    currency
                  )}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Propina al Barbero (Excluida)
                </dt>
                <dd className="font-semibold mt-0.5">
                  {formatAccountingCurrency(selectedRow.tipAmount, currency)}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Impacto en Totales
                </dt>
                <dd className="font-semibold mt-0.5">
                  {selectedRow.isCountedInTotals
                    ? "Contabilizado en el reporte"
                    : "Excluido (pendiente o anulado)"}
                </dd>
              </div>
            </dl>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={closeDetailModal}
                className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
