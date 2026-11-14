/* =====================================================================
   PÁGINA ADMINISTRATIVA: REPORTE DETALLADO DE CONTABILIDAD Y GANANCIAS
   (app/admin/contabilidad/ganancias/page.tsx)
   ===================================================================== */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ProfitReportFilters from "@/components/accounting/ProfitReportFilters";
import ProfitSummaryCards from "@/components/accounting/ProfitSummaryCards";
import ProfitTrendChart from "@/components/accounting/ProfitTrendChart";
import RevenueBreakdownChart from "@/components/accounting/RevenueBreakdownChart";
import ExpenseBreakdownChart from "@/components/accounting/ExpenseBreakdownChart";
import AccountingTransactionsTable from "@/components/accounting/AccountingTransactionsTable";
import { getAuthenticatedProfile } from "@/lib/accounting/profit-report.repository";
import { getServerProfitReport } from "@/lib/accounting/profit-report.service";

export const metadata: Metadata = {
  title: "Contabilidad y Reporte de Ganancias | JM Barber Studio",
  description:
    "Reporte financiero detallado de ingresos netos, costos directos, ganancia bruta, gastos operativos y ganancia neta.",
};

type SearchParamsInput = Promise<{
  [key: string]: string | string[] | undefined;
}>;

function firstParam(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

export default async function AdminProfitReportPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  // 1. Verificar sesión y permiso exclusivo de administrador en el servidor
  const currentUser = await getAuthenticatedProfile();
  if (!currentUser) {
    redirect("/login?return_url=/admin/contabilidad/ganancias");
  }

  if (currentUser.role !== "admin") {
    redirect(currentUser.role === "barbero" ? "/admin" : "/cliente");
  }

  const resolvedParams = await searchParams;
  const rawFilters: Record<string, unknown> = {
    startDate: firstParam(resolvedParams.startDate),
    endDate: firstParam(resolvedParams.endDate),
    quickPeriod: firstParam(resolvedParams.quickPeriod),
    barberId: firstParam(resolvedParams.barberId),
    serviceId: firstParam(resolvedParams.serviceId),
    paymentMethod: firstParam(resolvedParams.paymentMethod),
    paymentStatus: firstParam(resolvedParams.paymentStatus),
    expenseCategoryId: firstParam(resolvedParams.expenseCategoryId),
    page: firstParam(resolvedParams.page),
    pageSize: firstParam(resolvedParams.pageSize),
    sortBy: firstParam(resolvedParams.sortBy),
    sortOrder: firstParam(resolvedParams.sortOrder),
  };

  const reportResponse = await getServerProfitReport(rawFilters, currentUser);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <AppHeader user={currentUser} currentRole="admin" />

      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)] flex-1">
        <div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin-tablet lg:px-margin py-space-md">
          <div className="flex flex-col lg:flex-row gap-space-lg items-start">
            <AdminSidebar
              currentPath="/admin/contabilidad/ganancias"
              adminUser={currentUser}
            />

            <div className="flex-1 w-full min-w-0 flex flex-col gap-6">
              {/* Encabezado del módulo contable */}
              <header className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="font-label-sm uppercase tracking-widest text-secondary font-bold">
                    Módulo Financiero y Contable
                  </span>
                  <h1 className="font-headline-md text-on-surface font-bold mt-1">
                    Reporte Detallado de Ganancias
                  </h1>
                  <p className="font-body-sm text-on-surface-variant mt-1">
                    Cálculo auditable de ingresos confirmados, costos directos (insumos y comisiones),
                    gastos operativos y márgenes de rentabilidad reales.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3.5 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm uppercase tracking-wider font-bold">
                    Acceso exclusivo Admin
                  </span>
                </div>
              </header>

              {/* Estado de error controlado cuando los parámetros de consulta son inválidos */}
              {!reportResponse.success ? (
                <div
                  role="alert"
                  className="bg-error-container text-on-error-container p-6 rounded-2xl border border-error/30 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2 font-title-lg font-bold">
                    <span
                      className="material-symbols-outlined text-[24px]"
                      aria-hidden="true"
                    >
                      error
                    </span>
                    <span>
                      No se pudo generar el reporte ({reportResponse.error.code})
                    </span>
                  </div>
                  <p className="font-body-md">{reportResponse.error.message}</p>
                  <div>
                    <Link
                      href="/admin/contabilidad/ganancias?quickPeriod=this_month"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary font-label-md text-sm"
                    >
                      <span>Restablecer al mes actual</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. Selector de rango de fechas y filtros */}
                  <ProfitReportFilters
                    appliedFilters={reportResponse.data.appliedFilters}
                    period={reportResponse.data.period}
                    filterOptions={reportResponse.data.filterOptions}
                  />

                  {/* 2. Tarjetas de 12 indicadores principales y estado de completitud */}
                  <ProfitSummaryCards
                    summary={reportResponse.data.summary}
                    comparison={reportResponse.data.comparison}
                    completeness={reportResponse.data.completeness}
                    currency={reportResponse.data.period.currency}
                  />

                  {/* 3. Evolución temporal */}
                  <ProfitTrendChart
                    timeSeries={reportResponse.data.breakdowns.timeSeries}
                    granularity={reportResponse.data.period.granularity}
                    currency={reportResponse.data.period.currency}
                  />

                  {/* 4. Desgloses por servicio, barbero y método de pago */}
                  <RevenueBreakdownChart
                    byService={reportResponse.data.breakdowns.byService}
                    byBarber={reportResponse.data.breakdowns.byBarber}
                    byPaymentMethod={
                      reportResponse.data.breakdowns.byPaymentMethod
                    }
                    currency={reportResponse.data.period.currency}
                  />

                  {/* 5. Desglose de gastos operativos por categoría */}
                  <ExpenseBreakdownChart
                    byExpenseCategory={
                      reportResponse.data.breakdowns.byExpenseCategory
                    }
                    totalOperatingExpenses={
                      reportResponse.data.summary.operatingExpenses
                    }
                    currency={reportResponse.data.period.currency}
                  />

                  {/* 6. Tabla detallada de movimientos auditables con paginación en servidor */}
                  <AccountingTransactionsTable
                    transactions={reportResponse.data.transactions}
                    summary={reportResponse.data.summary}
                    currency={reportResponse.data.period.currency}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
