/* =====================================================================
   DESGLOSE DE GASTOS OPERATIVOS POR CATEGORÍA
   (components/accounting/ExpenseBreakdownChart.tsx)
   ===================================================================== */

import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import type { ExpenseCategoryBreakdownItem } from "@/lib/accounting/profit-report.types";

interface ExpenseBreakdownChartProps {
  byExpenseCategory: ExpenseCategoryBreakdownItem[];
  totalOperatingExpenses: string;
  currency: string;
}

export default function ExpenseBreakdownChart({
  byExpenseCategory,
  totalOperatingExpenses,
  currency,
}: ExpenseBreakdownChartProps) {
  return (
    <section
      aria-labelledby="expense-breakdown-heading"
      className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
            Estructura de Egresos
          </span>
          <h2
            id="expense-breakdown-heading"
            className="font-title-lg text-on-surface font-bold"
          >
            Gastos Operativos por Categoría
          </h2>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-surface-container text-xs font-semibold text-on-surface">
          Total Gastos Operativos:{" "}
          {formatAccountingCurrency(totalOperatingExpenses, currency)}
        </div>
      </div>

      {byExpenseCategory.length === 0 ? (
        <div className="p-6 rounded-xl bg-surface-container-low text-center text-on-surface-variant font-body-sm">
          No se registran gastos operativos en el periodo actual ni en el periodo anterior equivalente.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Barras horizontales de participación en el gasto */}
          <div className="flex flex-col gap-2.5">
            {byExpenseCategory
              .filter((c) => c.recordsCount > 0)
              .map((cat) => {
                const share = Number(cat.expenseSharePercentage ?? "0");
                return (
                  <div key={cat.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-on-surface">
                        {cat.label} ({cat.recordsCount} reg.)
                      </span>
                      <span className="text-on-surface-variant font-medium">
                        {formatAccountingCurrency(cat.totalAmount, currency)} (
                        {cat.expenseSharePercentage ?? "0.00"}%)
                      </span>
                    </div>
                    <div
                      className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-secondary"
                        style={{ width: `${Math.max(3, Math.min(100, share))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-labelledby="expense-category-table-caption"
            className="overflow-x-auto border border-surface-container-high/60 rounded-xl"
          >
            <table className="w-full text-left border-collapse text-sm">
              <caption id="expense-category-table-caption" className="sr-only">
                Desglose de gastos operativos por categoría y comparación con el periodo anterior
              </caption>
              <thead className="sticky top-0 z-10 bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
                <tr>
                  <th scope="col" className="py-3 px-4">
                    Categoría de Gasto
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    N.º Registros
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Importe Actual
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Participación
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Periodo Anterior
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Variación frente a Anterior
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {byExpenseCategory.map((cat) => {
                  const dirText =
                    cat.direction === "increase"
                      ? "Mayor gasto"
                      : cat.direction === "decrease"
                      ? "Menor gasto"
                      : "Sin cambio";

                  return (
                    <tr
                      key={cat.category}
                      className="hover:bg-surface-container-low/40"
                    >
                      <th
                        scope="row"
                        className="py-3 px-4 font-semibold text-on-surface"
                      >
                        {cat.label}
                      </th>
                      <td className="py-3 px-3 text-right">{cat.recordsCount}</td>
                      <td className="py-3 px-3 text-right font-semibold text-on-surface">
                        {formatAccountingCurrency(cat.totalAmount, currency)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {cat.expenseSharePercentage !== null
                          ? `${cat.expenseSharePercentage}%`
                          : "0.00%"}
                      </td>
                      <td className="py-3 px-3 text-right text-on-surface-variant">
                        {formatAccountingCurrency(
                          cat.previousTotalAmount,
                          currency
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium">
                        {cat.percentageChange !== null
                          ? `${dirText} (${
                              Number(cat.percentageChange) > 0 ? "+" : ""
                            }${cat.percentageChange}%)`
                          : `${dirText} (Nuevo vs 0)`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
