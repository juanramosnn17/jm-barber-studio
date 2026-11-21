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
import { isApiConfigured } from "@/lib/api/config";
import { API_UNAVAILABLE_MESSAGE, apiDownload } from "@/lib/api/client";
import { buildReportQuery, getApiProfitReport } from "@/lib/api/accounting";

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

/** Código HTTP para cada error del reporte que viene de la API. */
const API_ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_FILTER: 400,
  INVALID_DATE_RANGE: 400,
  DATE_RANGE_TOO_LARGE: 400,
};

/**
 * Con la API Spring Boot, el JSON también sale de GET /accounting/report: nunca se lee
 * Supabase cuando existe API_URL (tarea 4.14, auditoría #9). La API valida el rol ADMIN.
 */
async function apiJsonReport(filters: Record<string, unknown>) {
  const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
  const result = await getApiProfitReport(
    buildReportQuery({
      quickPeriod: text(filters.quickPeriod),
      startDate: text(filters.startDate),
      endDate: text(filters.endDate),
      page: text(filters.page),
      pageSize: text(filters.pageSize),
    })
  );
  const headers = { "Cache-Control": "no-store, max-age=0" };
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: API_ERROR_STATUS[result.error.code] ?? 503, headers }
    );
  }
  return NextResponse.json({ success: true, data: result.data }, { status: 200, headers });
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase();

  // Con la API Spring Boot, el CSV (saneado) lo genera la API; aquí solo se reenvía (tarea 4.9).
  // La API valida el rol ADMIN con el token de la cookie.
  if (format === "csv" && isApiConfigured()) {
    const sp = request.nextUrl.searchParams;
    const query = buildReportQuery({
      quickPeriod: sp.get("quickPeriod") ?? undefined,
      startDate: sp.get("startDate") ?? undefined,
      endDate: sp.get("endDate") ?? undefined,
    });
    const upstream = await apiDownload(`/accounting/report.csv?${query}`);
    if (!upstream || !upstream.ok) {
      const body = upstream ? await upstream.json().catch(() => null) : null;
      return NextResponse.json(
        {
          success: false,
          error: { code: "EXPORT_FAILED", message: body?.message ?? API_UNAVAILABLE_MESSAGE },
        },
        { status: upstream?.status ?? 503 }
      );
    }
    return new NextResponse(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/csv; charset=utf-8",
        "Content-Disposition": upstream.headers.get("Content-Disposition") ?? 'attachment; filename="reporte-contable.csv"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const rawFilters = extractQueryFilters(request);

  if (isApiConfigured()) {
    return apiJsonReport(rawFilters);
  }

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

  if (isApiConfigured()) {
    return apiJsonReport(body);
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
