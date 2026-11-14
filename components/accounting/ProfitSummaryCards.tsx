/* =====================================================================
   TARJETAS PRINCIPALES DE CONTABILIDAD
   (components/accounting/ProfitSummaryCards.tsx)
   ---------------------------------------------------------------------
   Vista simple para la barbería (spec F5, tarea 3.28):
     Ingresos · Tu ganancia · Reserva del negocio · Gastos · Saldo de la reserva
   y una línea secundaria con servicios, ticket promedio y propinas.
   ===================================================================== */

import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import type {
  DataCompletenessStatus,
  ProfitComparisonMap,
  ProfitSummary,
} from "@/lib/accounting/profit-report.types";

interface ProfitSummaryCardsProps {
  summary: ProfitSummary;
  /** Se conserva por compatibilidad; la vista simple no muestra comparativas. */
  comparison?: ProfitComparisonMap;
  completeness: DataCompletenessStatus;
  currency: string;
}

export default function ProfitSummaryCards({
  summary,
  completeness,
  currency,
}: ProfitSummaryCardsProps) {
  const reserveBalance = Number(summary.directCosts) - Number(summary.operatingExpenses);

  const cards = [
    {
      id: "income",
      title: "Ingresos",
      value: Number(summary.netRevenue),
      hint: "Lo cobrado (con descuentos y reembolsos ya restados).",
      primary: false,
    },
    {
      id: "your-profit",
      title: "Tu ganancia",
      value: Number(summary.grossProfit),
      hint: "Ingresos − Reserva del negocio.",
      primary: true,
    },
    {
      id: "reserve",
      title: "Reserva del negocio",
      value: Number(summary.directCosts),
      hint: "Lo apartado de cada servicio para los gastos.",
      primary: false,
    },
    {
      id: "expenses",
      title: "Gastos",
      value: Number(summary.operatingExpenses),
      hint: "Arriendo, servicios, compras y demás.",
      primary: false,
    },
    {
      id: "reserve-balance",
      title: "Saldo de la reserva",
      value: reserveBalance,
      hint: reserveBalance < 0 ? "La reserva no alcanzó para los gastos." : "Reserva − Gastos.",
      primary: false,
    },
  ];

  return (
    <section aria-label="Resumen de contabilidad" className="flex flex-col gap-3">
      {completeness.warnings.length > 0 && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-secondary-fixed/40 text-on-secondary-fixed text-sm flex items-start gap-2"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            info
          </span>
          <ul className="flex flex-col gap-0.5">
            {completeness.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((card) => {
          const negative = card.value < 0;
          return (
            <div
              key={card.id}
              className={`p-5 rounded-2xl shadow-sm border flex flex-col gap-1.5 ${
                card.primary
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-container-lowest text-on-surface border-surface-container-high/60"
              }`}
            >
              <span
                className={`text-label-md font-bold ${
                  card.primary ? "text-secondary-fixed" : "text-on-surface-variant"
                }`}
              >
                {card.title}
              </span>
              <span
                className={`text-headline-sm font-bold ${
                  negative ? "text-error" : ""
                }`}
              >
                {formatAccountingCurrency(card.value, currency)}
              </span>
              <span
                className={`font-body-sm ${
                  card.primary ? "text-on-primary/80" : "text-on-surface-variant"
                }`}
              >
                {card.hint}
              </span>
            </div>
          );
        })}
      </div>

      <p className="font-body-sm text-on-surface-variant px-1">
        {summary.paidServicesCount}{" "}
        {summary.paidServicesCount === 1 ? "servicio" : "servicios"} · ticket promedio{" "}
        {summary.averageTicket !== null
          ? formatAccountingCurrency(summary.averageTicket, currency)
          : "—"}{" "}
        · propinas {formatAccountingCurrency(summary.tipsExcluded, currency)}
      </p>
    </section>
  );
}
