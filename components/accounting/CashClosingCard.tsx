/* =====================================================================
   CIERRE DE CAJA DEL DÍA (components/accounting/CashClosingCard.tsx)
   ---------------------------------------------------------------------
   Tarea 3.31 (spec F5): lo cobrado por método de pago, propinas, gastos
   y el efectivo que debe haber en caja. Server Component: el selector de
   fecha es un formulario GET (?cierre=YYYY-MM-DD), sin JavaScript.
   ===================================================================== */

import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import { PAYMENT_METHOD_LABELS } from "@/lib/accounting/profit-report.validation";
import type { ApiCashClosing } from "@/lib/api/accounting";
import type { PaymentMethod } from "@/lib/types";
import ErrorMessage from "@/components/ui/ErrorMessage";

interface CashClosingCardProps {
  closing: ApiCashClosing | { error: string };
  /** Parámetros del reporte que se conservan al cambiar el día del cierre (periodo activo). */
  keepParams?: Record<string, string | undefined>;
}

export default function CashClosingCard({ closing, keepParams = {} }: CashClosingCardProps) {
  if ("error" in closing) {
    return (
      <section aria-labelledby="cash-closing-title" className="flex flex-col gap-3">
        <h2 id="cash-closing-title" className="font-title-lg text-on-surface font-bold">Cierre de caja</h2>
        <ErrorMessage message={closing.error} />
      </section>
    );
  }

  const negative = closing.expectedCash < 0;

  return (
    <section
      aria-labelledby="cash-closing-title"
      className="bg-surface-container-lowest p-5 md:p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 id="cash-closing-title" className="font-title-lg text-on-surface font-bold">
            Cierre de caja
          </h2>
          <p className="font-body-sm text-on-surface-variant">
            Lo cobrado por cada método el {closing.date}, con propinas y gastos.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          {Object.entries(keepParams).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="cash-closing-date" className="font-label-sm text-on-surface-variant uppercase">
              Día
            </label>
            <input
              id="cash-closing-date"
              name="cierre"
              type="date"
              required
              defaultValue={closing.date}
              className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-4 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors font-label-md"
          >
            Ver cierre
          </button>
        </form>
      </div>

      <div
        className={`p-4 rounded-2xl flex flex-col gap-0.5 ${
          negative ? "bg-error-container text-on-error-container" : "bg-primary text-on-primary"
        }`}
      >
        <span className={`text-label-md font-bold ${negative ? "" : "text-secondary-fixed"}`}>
          Efectivo que debe haber en caja
        </span>
        <span className="text-headline-sm font-bold">{formatAccountingCurrency(closing.expectedCash, "COP")}</span>
        <span className="font-body-sm opacity-80">
          {negative
            ? "Se pagó en efectivo más de lo que entró en efectivo."
            : "Cobrado en efectivo + propinas en efectivo − gastos pagados en efectivo."}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Cierre de caja por método de pago</caption>
          <thead>
            <tr className="text-left text-on-surface-variant font-label-sm uppercase">
              <th scope="col" className="py-2 pr-3">Método</th>
              <th scope="col" className="py-2 px-3 text-right">Cobrado</th>
              <th scope="col" className="py-2 px-3 text-right">Propinas</th>
              <th scope="col" className="py-2 px-3 text-right">Gastos</th>
              <th scope="col" className="py-2 pl-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {closing.methods.map((m) => {
              const method = m.paymentMethod.toLowerCase() as PaymentMethod;
              return (
                <tr key={m.paymentMethod} className="border-t border-surface-container-high/60">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-on-surface">
                    {PAYMENT_METHOD_LABELS[method] ?? m.paymentMethod}
                  </th>
                  <td className="py-2 px-3 text-right">{formatAccountingCurrency(m.income, "COP")}</td>
                  <td className="py-2 px-3 text-right">{formatAccountingCurrency(m.tips, "COP")}</td>
                  <td className="py-2 px-3 text-right">{formatAccountingCurrency(m.expenses, "COP")}</td>
                  <td className={`py-2 pl-3 text-right font-semibold ${m.balance < 0 ? "text-error" : ""}`}>
                    {formatAccountingCurrency(m.balance, "COP")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-container-high font-semibold">
              <th scope="row" className="py-2 pr-3 text-left">Total</th>
              <td className="py-2 px-3 text-right">{formatAccountingCurrency(closing.totals.income, "COP")}</td>
              <td className="py-2 px-3 text-right">{formatAccountingCurrency(closing.totals.tips, "COP")}</td>
              <td className="py-2 px-3 text-right">{formatAccountingCurrency(closing.totals.expenses, "COP")}</td>
              <td className="py-2 pl-3 text-right">
                {formatAccountingCurrency(closing.totals.income + closing.totals.tips - closing.totals.expenses, "COP")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
