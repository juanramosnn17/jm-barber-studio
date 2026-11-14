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
              {/* Título solo para lectores de pantalla (sin sección visible) */}
              <h1 className="sr-only">Contabilidad</h1>

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

                  {/* 2. Tarjetas principales (Ingresos, Tu ganancia, Reserva, Gastos, Saldo) */}
                  <ProfitSummaryCards
                    summary={reportResponse.data.summary}
                    comparison={reportResponse.data.comparison}
                    completeness={reportResponse.data.completeness}
                    currency={reportResponse.data.period.currency}
                  />

                  {/* 3. Movimientos del periodo (fila clicable abre el detalle y los ajustes) */}
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
