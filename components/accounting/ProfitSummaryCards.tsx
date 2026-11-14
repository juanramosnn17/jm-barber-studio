/* =====================================================================
   TARJETAS DE INDICADORES FINANCIEROS PRINCIPALES (KPIs)
   (components/accounting/ProfitSummaryCards.tsx)
   ===================================================================== */

import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import type {
  DataCompletenessStatus,
  MetricComparison,
  ProfitComparisonMap,
  ProfitSummary,
} from "@/lib/accounting/profit-report.types";

interface ProfitSummaryCardsProps {
  summary: ProfitSummary;
  comparison: ProfitComparisonMap;
  completeness: DataCompletenessStatus;
  currency: string;
}

function renderComparisonBadge(
  comp: MetricComparison,
  options: { isPercentageMetric?: boolean; isIntegerMetric?: boolean; isExpenseOrDeduction?: boolean } = {}
) {
  const { direction, percentageChange, previous } = comp;

  if (previous === null) {
    return (
      <span className="font-body-sm text-on-surface-variant">
        Sin referencia previa
      </span>
    );
  }

  let icon = "trending_flat";
  let directionLabel = "Sin cambio";
  if (direction === "increase") {
    icon = "trending_up";
    directionLabel = options.isExpenseOrDeduction ? "Aumento de egreso" : "Aumento";
  } else if (direction === "decrease") {
    icon = "trending_down";
    directionLabel = options.isExpenseOrDeduction ? "Reducción de egreso" : "Disminución";
  }

  let badgeStyle = "bg-surface-container text-on-surface-variant";
  if (comp.isFavorable === true) {
    badgeStyle = "bg-green-100 text-green-900 border border-green-300";
  } else if (comp.isFavorable === false) {
    badgeStyle = "bg-amber-100 text-amber-950 border border-amber-300";
  }

  const pctText =
    percentageChange !== null
      ? `${Number(percentageChange) > 0 ? "+" : ""}${percentageChange}%`
      : direction === "unchanged"
      ? "0.00%"
      : "Nuevo vs 0";

  const prevFormatted = options.isPercentageMetric
    ? `${previous}%`
    : options.isIntegerMetric
    ? previous
    : formatAccountingCurrency(previous);

  return (
    <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-surface-container-high/50">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeStyle}`}
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            {icon}
          </span>
          <span>
            {directionLabel}: {pctText}
          </span>
        </span>
      </div>
      <span className="text-xs text-on-surface-variant">
        Periodo anterior: <strong>{prevFormatted}</strong>
      </span>
    </div>
  );
}

export default function ProfitSummaryCards({
  summary,
  comparison,
  completeness,
  currency,
}: ProfitSummaryCardsProps) {
  const kpiCards = [
    {
      id: "gross-revenue",
      title: "1. Ingresos Brutos",
      value: formatAccountingCurrency(summary.grossRevenue, currency),
      badge: "Almacenado / Calculado",
      formula: "Suma de pagos confirmados por servicios completados (sin propinas).",
      comparison: renderComparisonBadge(comparison.grossRevenue),
      highlight: false,
    },
    {
      id: "discounts",
      title: "2. Descuentos",
      value: formatAccountingCurrency(summary.discounts, currency),
      badge: "Deducción",
      formula: "Descuentos comerciales aplicados sobre citas pagadas.",
      comparison: renderComparisonBadge(comparison.discounts, {
        isExpenseOrDeduction: true,
      }),
      highlight: false,
    },
    {
      id: "refunds",
      title: "3. Reembolsos / Devoluciones",
      value: formatAccountingCurrency(summary.refunds, currency),
      badge: "Deducción",
      formula: "Importes devueltos parcial o totalmente al cliente.",
      comparison: renderComparisonBadge(comparison.refunds, {
        isExpenseOrDeduction: true,
      }),
      highlight: false,
    },
    {
      id: "net-revenue",
      title: "4. Ingresos Netos",
      value: formatAccountingCurrency(summary.netRevenue, currency),
      badge: "Fórmula contable",
      formula: "Ingresos brutos − Descuentos − Reembolsos.",
      comparison: renderComparisonBadge(comparison.netRevenue),
      highlight: true,
    },
    {
      id: "direct-costs",
      title: "5. Costos Directos",
      value: formatAccountingCurrency(summary.directCosts, currency),
      badge: "Costo variable",
      formula: `Insumos (${formatAccountingCurrency(
        summary.supplyCosts,
        currency
      )}) + Comisiones barberos (${formatAccountingCurrency(
        summary.commissions,
        currency
      )}).`,
      comparison: renderComparisonBadge(comparison.directCosts, {
        isExpenseOrDeduction: true,
      }),
      highlight: false,
    },
    {
      id: "gross-profit",
      title: "6. Ganancia Bruta",
      value: formatAccountingCurrency(summary.grossProfit, currency),
      badge: "Resultado bruto",
      formula: "Ingresos netos − Costos directos.",
      comparison: renderComparisonBadge(comparison.grossProfit),
      highlight: true,
    },
    {
      id: "operating-expenses",
      title: "7. Gastos Operativos",
      value: formatAccountingCurrency(summary.operatingExpenses, currency),
      badge: "Egreso fijo/operativo",
      formula:
        "Arriendo + Servicios públicos + Nómina admin + Publicidad + Mantenimiento + Otros.",
      comparison: renderComparisonBadge(comparison.operatingExpenses, {
        isExpenseOrDeduction: true,
      }),
      highlight: false,
    },
    {
      id: "net-profit",
      title: "8. Ganancia Neta",
      value:
        summary.netProfit !== null
          ? formatAccountingCurrency(summary.netProfit, currency)
          : `${formatAccountingCurrency(summary.partialNetProfit, currency)} (Parcial)`,
      badge: completeness.isComplete ? "Resultado neto" : "Dato parcial",
      formula: "Ganancia bruta − Gastos operativos.",
      comparison: renderComparisonBadge(comparison.netProfit),
      highlight: true,
      isPrimaryNet: true,
    },
    {
      id: "gross-margin",
      title: "9. Margen Bruto (%)",
      value:
        summary.grossMarginPercentage !== null
          ? `${summary.grossMarginPercentage}%`
          : "N/A (Ingresos = 0)",
      badge: "Rentabilidad bruta",
      formula: "(Ganancia bruta ÷ Ingresos netos) × 100.",
      comparison: renderComparisonBadge(comparison.grossMarginPercentage, {
        isPercentageMetric: true,
      }),
      highlight: false,
    },
    {
      id: "net-margin",
      title: "10. Margen Neto (%)",
      value:
        summary.netMarginPercentage !== null
          ? `${summary.netMarginPercentage}%`
          : "N/A",
      badge: "Rentabilidad final",
      formula: "(Ganancia neta ÷ Ingresos netos) × 100.",
      comparison: renderComparisonBadge(comparison.netMarginPercentage, {
        isPercentageMetric: true,
      }),
      highlight: false,
    },
    {
      id: "paid-services-count",
      title: "11. Servicios Pagados",
      value: String(summary.paidServicesCount),
      badge: "Volumen operativo",
      formula: "Citas completadas con pago confirmado e ingreso neto positivo.",
      comparison: renderComparisonBadge(comparison.paidServicesCount, {
        isIntegerMetric: true,
      }),
      highlight: false,
    },
    {
      id: "average-ticket",
      title: "12. Ticket Promedio",
      value:
        summary.averageTicket !== null
          ? formatAccountingCurrency(summary.averageTicket, currency)
          : "N/A",
      badge: "Promedio por servicio",
      formula: "Ingresos netos ÷ Número de servicios pagados.",
      comparison: renderComparisonBadge(comparison.averageTicket),
      highlight: false,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Avisos de completitud de datos y advertencias contables */}
      {(!completeness.isComplete || completeness.warnings.length > 0) && (
        <div
          role="region"
          aria-label="Advertencias de integridad contable"
          className="p-4 rounded-2xl bg-secondary-fixed/40 border border-secondary/40 text-on-surface flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 font-title-md font-bold text-on-secondary-fixed">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              info
            </span>
            <span>Aviso de trazabilidad y completitud de datos</span>
          </div>

          {!completeness.isComplete && (
            <p className="font-body-sm">
              <strong>Componentes pendientes de completar:</strong>{" "}
              {completeness.missingComponents.join(", ")}. Los indicadores dependientes se muestran
              marcados como parciales.
            </p>
          )}

          {completeness.warnings.map((w, idx) => (
            <p key={idx} className="font-body-sm text-on-surface-variant">
              • {w}
            </p>
          ))}
        </div>
      )}

      {/* Grid de 12 tarjetas de indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const isNegativeValue = card.value.startsWith("-");
          return (
            <article
              key={card.id}
              className={`p-5 rounded-2xl shadow-sm flex flex-col justify-between border transition-all ${
                card.isPrimaryNet
                  ? "bg-primary text-on-primary border-primary"
                  : card.highlight
                  ? "bg-surface-container-lowest border-secondary/40"
                  : "bg-surface-container-lowest border-surface-container-high/60"
              }`}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h2
                    className={`font-label-sm uppercase tracking-wider font-bold ${
                      card.isPrimaryNet
                        ? "text-secondary-fixed"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {card.title}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      card.isPrimaryNet
                        ? "bg-white/15 text-white"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {card.badge}
                  </span>
                </div>

                <p
                  className={`font-headline-md font-bold mt-1 ${
                    card.isPrimaryNet
                      ? isNegativeValue
                        ? "text-red-300"
                        : "text-white"
                      : isNegativeValue
                      ? "text-error"
                      : "text-on-surface"
                  }`}
                >
                  {card.value}
                </p>

                <p
                  className={`text-xs leading-snug ${
                    card.isPrimaryNet
                      ? "text-white/80"
                      : "text-on-surface-variant"
                  }`}
                >
                  {card.formula}
                </p>
              </div>

              <div className={card.isPrimaryNet ? "text-white/90" : ""}>
                {card.comparison}
              </div>
            </article>
          );
        })}
      </div>

      {/* Nota informativa de propinas y reglas contables aplicadas */}
      <div className="px-4 py-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[18px] text-secondary"
            aria-hidden="true"
          >
            verified_user
          </span>
          <span>
            <strong>Propinas recaudadas para barberos (excluidas de ingresos del estudio):</strong>{" "}
            {formatAccountingCurrency(summary.tipsExcluded, currency)}
          </span>
        </div>
        <span>
          Cálculos ejecutados en servidor con precisión exacta de centavos (COP).
        </span>
      </div>
    </div>
  );
}
