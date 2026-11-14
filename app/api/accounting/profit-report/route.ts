/* =====================================================================
   ENDPOINT DE SERVIDOR: REPORTE CONTABLE DE GANANCIAS
   (app/api/accounting/profit-report/route.ts)
   ---------------------------------------------------------------------
   Soporta:
     - GET /api/accounting/profit-report?startDate=...&endDate=...
     - GET /api/accounting/profit-report?format=csv&startDate=...
     - POST /api/accounting/profit-report (cuerpo JSON con filtros)
   Valida autenticación y rol 'admin' en cada solicitud.
   ===================================================================== */

import { NextResponse, type NextRequest } from "next/server";
import {
  exportServerProfitReportCsv,
  getServerProfitReport,
} from "@/lib/accounting/profit-report.service";

function extractQueryFilters(request: NextRequest): Record<string, unknown> {
  const sp = request.nextUrl.searchParams;
  return {
    startDate: sp.get("startDate") ?? undefined,
    endDate: sp.get("endDate") ?? undefined,
    quickPeriod: sp.get("quickPeriod") ?? undefined,
    barberId: sp.get("barberId") ?? undefined,
    serviceId: sp.get("serviceId") ?? undefined,
    paymentMethod: sp.get("paymentMethod") ?? undefined,
    paymentStatus: sp.get("paymentStatus") ?? undefined,
    expenseCategoryId: sp.get("expenseCategoryId") ?? undefined,
    branchId: sp.get("branchId") ?? undefined,
    page: sp.get("page") ?? undefined,
    pageSize: sp.get("pageSize") ?? undefined,
    sortBy: sp.get("sortBy") ?? undefined,
    sortOrder: sp.get("sortOrder") ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase();
  const rawFilters = extractQueryFilters(request);

  if (format === "csv") {
    const csvResult = await exportServerProfitReportCsv(rawFilters);
    if (!csvResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: csvResult.error,
        },
        { status: csvResult.httpStatus }
      );
    }

    return new NextResponse(csvResult.csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvResult.filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const result = await getServerProfitReport(rawFilters);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      {
        status: result.httpStatus,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: result.data,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_FILTER",
          message: "El cuerpo de la solicitud no es un JSON válido.",
        },
      },
      { status: 400 }
    );
  }

  const result = await getServerProfitReport(body);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      {
        status: result.httpStatus,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: result.data,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
