/* =====================================================================
   GRÁFICO DE EVOLUCIÓN TEMPORAL DE INGRESOS Y GANANCIA NETA
   (components/accounting/ProfitTrendChart.tsx)
   ===================================================================== */

import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import type {
  TimeGranularity,
  TimeSeriesPoint,
} from "@/lib/accounting/profit-report.types";

interface ProfitTrendChartProps {
  timeSeries: TimeSeriesPoint[];
  granularity: TimeGranularity;
  currency: string;
}

const GRANULARITY_LABELS: Record<TimeGranularity, string> = {
  hour: "Por hora",
  day: "Por día",
  week: "Por semana",
  month: "Por mes",
};

export default function ProfitTrendChart({
  timeSeries,
  granularity,
  currency,
}: ProfitTrendChartProps) {
  const activePoints = timeSeries.filter(
    (p) =>
      Number(p.netRevenue) !== 0 ||
      Number(p.operatingExpenses) !== 0 ||
      Number(p.netProfit) !== 0
  );

  // Si hay muchos puntos vacíos en un mes completo, mostrar todos hasta un límite legible o los puntos con actividad
  const displayPoints =
    timeSeries.length > 16 && activePoints.length > 0
      ? activePoints
      : timeSeries.slice(0, 24);

  const values = displayPoints.flatMap((p) => [
    Math.abs(Number(p.netRevenue)),
    Math.abs(Number(p.netProfit)),
    Math.abs(Number(p.directCosts) + Number(p.operatingExpenses)),
  ]);
  const maxVal = Math.max(1, ...values);

  const chartHeight = 220;
  const barGroupWidth = 56;
  const svgWidth = Math.max(520, displayPoints.length * barGroupWidth + 60);

  return (
    <section
      aria-labelledby="profit-trend-heading"
      className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col gap-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
            Evolución Temporal ({GRANULARITY_LABELS[granularity]})
          </span>
          <h2
            id="profit-trend-heading"
            className="font-title-lg text-on-surface font-bold"
          >
            Ingresos Netos, Egresos Totales y Ganancia Neta
          </h2>
        </div>

        {/* Leyenda accesible con formas y patrones diferenciados */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-xs bg-primary inline-block"
              aria-hidden="true"
            />
            <span>Ingresos Netos</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-xs bg-outline-variant inline-block border border-on-surface"
              aria-hidden="true"
            />
            <span>Costos + Gastos</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full bg-secondary inline-block"
              aria-hidden="true"
            />
            <span>Ganancia Neta</span>
          </span>
        </div>
      </div>

      {activePoints.length === 0 ? (
        <div className="p-8 rounded-xl bg-surface-container-low text-center text-on-surface-variant font-body-md">
          No se registran movimientos financieros confirmados en los intervalos del periodo seleccionado.
        </div>
      ) : (
        <figure className="flex flex-col gap-3">
          <div className="overflow-x-auto pb-2">
            <svg
              role="img"
              viewBox={`0 0 ${svgWidth} ${chartHeight + 48}`}
              className="w-full min-w-[520px] h-64"
            >
              <title>
                Gráfico de barras comparativo de ingresos netos, egresos y ganancia neta por{" "}
                {GRANULARITY_LABELS[granularity].toLowerCase()}
              </title>

              {/* Líneas guía horizontales */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartHeight - ratio * (chartHeight - 24);
                return (
                  <g key={ratio}>
                    <line
                      x1={16}
                      y1={y}
                      x2={svgWidth - 16}
                      y2={y}
                      stroke="#e5e2db"
                      strokeDasharray={ratio === 0 ? undefined : "4 4"}
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {displayPoints.map((pt, idx) => {
                const netRev = Math.max(0, Number(pt.netRevenue));
                const totalOut =
                  Math.max(0, Number(pt.directCosts)) +
                  Math.max(0, Number(pt.operatingExpenses));
                const netProf = Number(pt.netProfit);
                const absProf = Math.abs(netProf);

                const revHeight = Math.round(
                  (netRev / maxVal) * (chartHeight - 28)
                );
                const outHeight = Math.round(
                  (totalOut / maxVal) * (chartHeight - 28)
                );
                const profHeight = Math.round(
                  (absProf / maxVal) * (chartHeight - 28)
                );

                const baseX = 28 + idx * barGroupWidth;

                return (
                  <g key={pt.bucketKey}>
                    {/* Barra 1: Ingresos Netos */}
                    <rect
                      x={baseX}
                      y={chartHeight - Math.max(2, revHeight)}
                      width={12}
                      height={Math.max(2, revHeight)}
                      rx={3}
                      fill="#000000"
                    />
                    {/* Barra 2: Costos + Gastos */}
                    <rect
                      x={baseX + 14}
                      y={chartHeight - Math.max(2, outHeight)}
                      width={12}
                      height={Math.max(2, outHeight)}
                      rx={3}
                      fill="#c8c5cb"
                    />
                    {/* Barra 3: Ganancia Neta (Dorado si positiva, Rojo si negativa) */}
                    <rect
                      x={baseX + 28}
                      y={chartHeight - Math.max(2, profHeight)}
                      width={12}
                      height={Math.max(2, profHeight)}
                      rx={3}
                      fill={netProf < 0 ? "#ba1a1a" : "#775a00"}
                    />
                    {/* Etiqueta del eje X */}
                    <text
                      x={baseX + 20}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#47464b"
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <figcaption className="text-xs text-on-surface-variant">
            Mostrando {displayPoints.length} intervalos agrupados{" "}
            {GRANULARITY_LABELS[granularity].toLowerCase()}. Las barras rojas en ganancia neta indican periodos donde los costos y gastos superaron los ingresos netos.
          </figcaption>

          {/* Tabla semántica alternativa accesible */}
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="time-series-table-caption"
            className="overflow-x-auto max-h-56 border border-surface-container-high/60 rounded-xl mt-1"
          >
            <table className="w-full text-left border-collapse text-xs">
              <caption
                id="time-series-table-caption"
                className="sr-only"
              >
                Tabla detallada de evolución temporal de ingresos, costos, gastos y ganancia neta
              </caption>
              <thead className="sticky top-0 z-10 bg-surface-container-low text-on-surface-variant uppercase">
                <tr>
                  <th scope="col" className="py-2.5 px-3">
                    Periodo
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Servicios Pagados
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Ingresos Netos
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Costos Directos
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Gastos Operativos
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Ganancia Neta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {displayPoints.map((pt) => (
                  <tr key={pt.bucketKey} className="hover:bg-surface-container-low/50">
                    <th scope="row" className="py-2 px-3 font-semibold text-on-surface">
                      {pt.label}
                    </th>
                    <td className="py-2 px-3 text-right">{pt.paidServicesCount}</td>
                    <td className="py-2 px-3 text-right">
                      {formatAccountingCurrency(pt.netRevenue, currency)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {formatAccountingCurrency(pt.directCosts, currency)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {formatAccountingCurrency(pt.operatingExpenses, currency)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        Number(pt.netProfit) < 0 ? "text-error" : "text-on-surface"
                      }`}
                    >
                      {formatAccountingCurrency(pt.netProfit, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      )}
    </section>
  );
}
