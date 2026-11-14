/* =====================================================================
   DESGLOSES DE INGRESOS: POR SERVICIO, POR BARBERO Y POR MÉTODO DE PAGO
   (components/accounting/RevenueBreakdownChart.tsx)
   ===================================================================== */

import { formatAccountingCurrency } from "@/lib/accounting/profit-report.calculations";
import type {
  BarberBreakdownItem,
  PaymentMethodBreakdownItem,
  ServiceBreakdownItem,
} from "@/lib/accounting/profit-report.types";

interface RevenueBreakdownChartProps {
  byService: ServiceBreakdownItem[];
  byBarber: BarberBreakdownItem[];
  byPaymentMethod: PaymentMethodBreakdownItem[];
  currency: string;
}

export default function RevenueBreakdownChart({
  byService,
  byBarber,
  byPaymentMethod,
  currency,
}: RevenueBreakdownChartProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Ingresos y Ganancia Bruta por Servicio */}
      <section
        aria-labelledby="breakdown-service-heading"
        className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col gap-4"
      >
        <div>
          <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
            Desglose por Catálogo
          </span>
          <h2
            id="breakdown-service-heading"
            className="font-title-lg text-on-surface font-bold"
          >
            Ingresos, Costos Directos y Ganancia Bruta por Servicio
          </h2>
        </div>

        {byService.length === 0 ? (
          <p className="p-6 rounded-xl bg-surface-container-low text-center text-on-surface-variant font-body-sm">
            No hay servicios pagados en el periodo seleccionado.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Barras horizontales de participación */}
            <div className="flex flex-col gap-2.5">
              {byService.map((srv) => {
                const share = Number(srv.revenueSharePercentage ?? "0");
                return (
                  <div key={srv.serviceId} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-on-surface">
                        {srv.serviceName} ({srv.paidQuantity} serv.)
                      </span>
                      <span className="text-on-surface-variant font-medium">
                        {formatAccountingCurrency(srv.netRevenue, currency)} (
                        {srv.revenueSharePercentage ?? "0.00"}%)
                      </span>
                    </div>
                    <div
                      className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(3, Math.min(100, share))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabla detallada por servicio */}
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="service-breakdown-caption"
              className="overflow-x-auto border border-surface-container-high/60 rounded-xl"
            >
              <table className="w-full text-left border-collapse text-sm">
                <caption id="service-breakdown-caption" className="sr-only">
                  Desglose financiero de ingresos y costos directos por servicio
                </caption>
                <thead className="sticky top-0 z-10 bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
                  <tr>
                    <th scope="col" className="py-3 px-4">
                      Servicio
                    </th>
                    <th scope="col" className="py-3 px-3 text-right">
                      Cant. Pagada
                    </th>
                    <th scope="col" className="py-3 px-3 text-right">
                      Ingresos Netos
                    </th>
                    <th scope="col" className="py-3 px-3 text-right">
                      Costo Directo (Insumos + Comisión)
                    </th>
                    <th scope="col" className="py-3 px-3 text-right">
                      Ganancia Bruta
                    </th>
                    <th scope="col" className="py-3 px-4 text-right">
                      Participación
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {byService.map((srv) => (
                    <tr
                      key={srv.serviceId}
                      className="hover:bg-surface-container-low/40"
                    >
                      <th
                        scope="row"
                        className="py-3 px-4 font-semibold text-on-surface"
                      >
                        {srv.serviceName}
                      </th>
                      <td className="py-3 px-3 text-right">{srv.paidQuantity}</td>
                      <td className="py-3 px-3 text-right font-medium">
                        {formatAccountingCurrency(srv.netRevenue, currency)}
                      </td>
                      <td className="py-3 px-3 text-right text-on-surface-variant">
                        {srv.directCost !== null
                          ? formatAccountingCurrency(srv.directCost, currency)
                          : "No disponible"}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-on-surface">
                        {formatAccountingCurrency(srv.grossProfit, currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {srv.revenueSharePercentage !== null
                          ? `${srv.revenueSharePercentage}%`
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 2. Resultados operativos y financieros por Barbero + 3. Método de Pago */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Resultados por Barbero */}
        <section
          aria-labelledby="breakdown-barber-heading"
          className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col gap-4"
        >
          <div>
            <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
              Liquidación Operativa
            </span>
            <h2
              id="breakdown-barber-heading"
              className="font-title-lg text-on-surface font-bold"
            >
              Resultados Financieros por Barbero
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Datos estrictamente contables y operativos para liquidación de comisiones y propinas.
            </p>
          </div>

          {byBarber.length === 0 ? (
            <p className="p-6 rounded-xl bg-surface-container-low text-center text-on-surface-variant font-body-sm">
              Sin servicios pagados asociados a barberos en este rango.
            </p>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="barber-breakdown-caption"
              className="overflow-x-auto border border-surface-container-high/60 rounded-xl"
            >
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <caption id="barber-breakdown-caption" className="sr-only">
                  Resultados financieros objetivos por barbero
                </caption>
                <thead className="sticky top-0 z-10 bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
                  <tr>
                    <th scope="col" className="py-3 px-3">
                      Barbero
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Serv. Pagados
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Ingreso Neto
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Descuentos
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Propinas
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Comisiones
                    </th>
                    <th scope="col" className="py-3 px-3 text-right">
                      Aporte Bruto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {byBarber.map((b) => (
                    <tr
                      key={b.barberName}
                      className="hover:bg-surface-container-low/40"
                    >
                      <th
                        scope="row"
                        className="py-3 px-3 font-semibold text-on-surface"
                      >
                        {b.barberName}
                      </th>
                      <td className="py-3 px-2 text-right">
                        {b.completedAndPaidCount}
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatAccountingCurrency(
                          b.netRevenueGenerated,
                          currency
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-on-surface-variant">
                        {formatAccountingCurrency(
                          b.discountsAssociated,
                          currency
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-on-surface-variant">
                        {formatAccountingCurrency(b.tipsReceived, currency)}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-secondary">
                        {formatAccountingCurrency(b.commissionsEarned, currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-on-surface">
                        {b.profitContribution !== null
                          ? formatAccountingCurrency(
                              b.profitContribution,
                              currency
                            )
                          : "N/D"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Ingresos por Método de Pago */}
        <section
          aria-labelledby="breakdown-payment-heading"
          className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col gap-4"
        >
          <div>
            <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
              Tesorería y Recaudo
            </span>
            <h2
              id="breakdown-payment-heading"
              className="font-title-lg text-on-surface font-bold"
            >
              Ingresos por Método de Pago
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Conciliación de transacciones cobradas por medio de pago.
            </p>
          </div>

          {byPaymentMethod.length === 0 ? (
            <p className="p-6 rounded-xl bg-surface-container-low text-center text-on-surface-variant font-body-sm">
              Sin cobros registrados por método de pago en este periodo.
            </p>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="payment-breakdown-caption"
              className="overflow-x-auto border border-surface-container-high/60 rounded-xl"
            >
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <caption id="payment-breakdown-caption" className="sr-only">
                  Ingresos desglosados por método de pago
                </caption>
                <thead className="sticky top-0 z-10 bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
                  <tr>
                    <th scope="col" className="py-3 px-3">
                      Método de Pago
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Transacciones
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Importe Bruto
                    </th>
                    <th scope="col" className="py-3 px-2 text-right">
                      Reembolsos
                    </th>
                    <th scope="col" className="py-3 px-3 text-right">
                      Importe Neto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {byPaymentMethod.map((pm) => (
                    <tr
                      key={pm.paymentMethod}
                      className="hover:bg-surface-container-low/40"
                    >
                      <th
                        scope="row"
                        className="py-3 px-3 font-semibold text-on-surface"
                      >
                        {pm.label}
                      </th>
                      <td className="py-3 px-2 text-right">
                        {pm.transactionsCount}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {formatAccountingCurrency(pm.grossAmount, currency)}
                      </td>
                      <td className="py-3 px-2 text-right text-on-surface-variant">
                        {formatAccountingCurrency(pm.refunds, currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-on-surface">
                        {formatAccountingCurrency(pm.netAmount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
