"use client";

/* =====================================================================
   TABLA DETALLADA Y AUDITABLE DE MOVIMIENTOS CONTABLES
   (components/accounting/AccountingTransactionsTable.tsx)
   ===================================================================== */

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import AccountingAdjustments from "@/components/accounting/AccountingAdjustments";
import type {
  AccountingTransactionRow,
  PaginatedTransactions,
  ProfitSummary,
} from "@/lib/accounting/profit-report.types";
import type { ExpenseCategory } from "@/lib/types";

interface AccountingTransactionsTableProps {
  transactions: PaginatedTransactions;
  summary: ProfitSummary;
  currency: string;
  /** Categorías válidas para editar un gasto (en modo API incluye "Compra de insumos / productos"). */
  expenseCategories: { id: ExpenseCategory; label: string }[];
  /** true con el backend Spring Boot: habilita propinas y ventas de productos (tareas 3.29 y 3.30). */
  apiMode: boolean;
}

export default function AccountingTransactionsTable({
  transactions,
  summary,
  currency,
  expenseCategories,
  apiMode,
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

  const openDetailModal = (row: AccountingTransactionRow) => {
    setSelectedRow(row);
    detailDialogRef.current?.showModal();
  };

  const closeDetailModal = () => {
    detailDialogRef.current?.close();
  };

  return (
    <section
      aria-labelledby="transactions-audit-heading"
      className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col overflow-hidden"
    >
      {/* Cabecera simple (spec F5, tarea 3.28) */}
      <div className="p-6 border-b border-surface-container-high/60">
        <h2
          id="transactions-audit-heading"
          className="text-title-lg text-on-surface font-bold"
        >
          Movimientos ({transactions.total})
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Toca un movimiento para ver el detalle, corregirlo o anularlo.
        </p>
      </div>

      <div className="overflow-x-auto max-h-[540px]">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <caption id="accounting-transactions-caption" className="sr-only">
            Movimientos del periodo: fecha, concepto, método de pago, ingreso, gasto y estado
          </caption>
          <thead className="sticky top-0 z-10 bg-surface-container-low text-on-surface-variant font-label-sm uppercase border-b border-surface-container-high/60">
            <tr>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Fecha</th>
              <th scope="col" className="py-3.5 px-3">Concepto</th>
              <th scope="col" className="py-3.5 px-3">Método</th>
              <th scope="col" className="py-3.5 px-3 text-right">Ingreso</th>
              <th scope="col" className="py-3.5 px-3 text-right">Gasto</th>
              <th scope="col" className="py-3.5 px-4">Estado</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-container-low">
            {transactions.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 px-6 text-center text-on-surface-variant font-body-md">
                  No hay movimientos en este periodo.
                </td>
              </tr>
            ) : (
              transactions.rows.map((row) => {
                const [, mm, dd] = row.date.split("-");
                const isExpense = row.source === "expense";
                const isSale = row.source === "product_sale";
                const status = isExpense
                  ? row.status === "anulado"
                    ? "Anulado"
                    : "Registrado"
                  : isSale
                  ? row.statusLabel
                  : row.isCountedInTotals
                  ? "Cobrada"
                  : "Sin cobro";
                return (
                  <tr
                    key={row.id}
                    onClick={() => openDetailModal(row)}
                    className={`cursor-pointer hover:bg-surface-container-low/60 transition-colors ${
                      !row.isCountedInTotals ? "opacity-65" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap text-on-surface">
                      {dd}/{mm} <span className="text-on-surface-variant">{row.time}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailModal(row);
                        }}
                        className="text-left font-medium text-on-surface hover:text-secondary"
                      >
                        {row.concept}
                      </button>
                      <span className="block text-xs text-on-surface-variant">
                        {isExpense ? "Gasto" : isSale ? "Venta de producto" : row.clientAnonymized ?? "Cliente"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-on-surface-variant whitespace-nowrap">
                      {row.paymentMethod ? row.paymentMethodLabel : "—"}
                    </td>
                    <td className="py-3.5 px-3 text-right font-semibold text-on-surface whitespace-nowrap">
                      {Number(row.netIncome) !== 0 ? formatAccountingCurrency(row.netIncome, currency) : "—"}
                    </td>
                    <td className="py-3.5 px-3 text-right font-medium text-on-surface-variant whitespace-nowrap">
                      {Number(row.operatingExpenseAmount) > 0
                        ? formatAccountingCurrency(row.operatingExpenseAmount, currency)
                        : "—"}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          status === "Cobrada"
                            ? "bg-secondary-fixed/70 text-on-secondary-fixed"
                            : status === "Registrado"
                            ? "bg-surface-container-highest text-on-surface"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          <tfoot className="bg-surface-container-low/90 border-t-2 border-surface-container-high font-semibold text-on-surface">
            <tr>
              <th scope="row" colSpan={3} className="py-3.5 px-4 text-left uppercase text-xs tracking-wider">
                Total del periodo
              </th>
              <td className="py-3.5 px-3 text-right whitespace-nowrap">
                {formatAccountingCurrency(summary.netRevenue, currency)}
              </td>
              <td className="py-3.5 px-3 text-right whitespace-nowrap">
                {formatAccountingCurrency(summary.operatingExpenses, currency)}
              </td>
              <td />
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
                  Detalle del movimiento
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
                  Cliente
                </dt>
                <dd className="font-semibold mt-0.5">
                  {selectedRow.clientAnonymized ?? "No aplica"}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  Precio del servicio
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
                  Gasto
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
                  Propina
                </dt>
                <dd className="font-semibold mt-0.5">
                  {formatAccountingCurrency(selectedRow.tipAmount, currency)}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low">
                <dt className="text-xs text-on-surface-variant uppercase">
                  ¿Suma en los totales?
                </dt>
                <dd className="font-semibold mt-0.5">
                  {selectedRow.isCountedInTotals
                    ? "Suma en los totales"
                    : "No suma (sin cobro o anulado)"}
                </dd>
              </div>
            </dl>

            {/* Ajustes contables del admin (spec F5, tareas 3.23–3.26) */}
            <AccountingAdjustments
              key={selectedRow.id}
              row={selectedRow}
              onDone={closeDetailModal}
              expenseCategories={expenseCategories}
              apiMode={apiMode}
            />

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
