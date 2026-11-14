# F5 · Módulo contable y reporte de ganancias

## Historia
Como administrador exclusivo del estudio, quiero consultar el reporte financiero detallado por rango de fechas, registrar gastos operativos y auditar cada transacción de ingreso o egreso (con opción de exportar a CSV), para conocer con exactitud la ganancia bruta y neta del negocio.

## Comportamiento
1. La ruta `/admin/contabilidad/ganancias` verifica en el servidor que el usuario tenga rol estricto `admin` (si es `barbero` lo redirige a `/admin` y si es `cliente` a `/cliente`).
2. En la parte superior incluye un formulario desplegable/modal que invoca `createExpenseAction` para registrar nuevos **gastos operativos** (fecha, categoría como arriendo, servicios públicos, nómina, insumos, publicidad, mantenimiento u otros, concepto, monto en COP, método de pago y referencia).
3. El componente `ProfitReportFilters` permite filtrar el reporte por periodos rápidos (`today`, `7d`, `30d`, `month`, `custom`), rango de fechas (`startDate`, `endDate`), barbero, servicio, método de pago, estado de pago y categoría de gasto.
4. El motor contable (`lib/accounting/`) calcula y muestra en `ProfitSummaryCards`: Ingresos Netos, Costos Directos + Comisiones, Ganancia Bruta, Gastos Operativos y **Ganancia Neta** (con porcentaje de variación frente al periodo anterior equivalente).
5. Muestra visualizaciones en `ProfitTrendChart` (evolución temporal), `RevenueBreakdownChart` (ingresos por servicio, barbero y medio de pago) y `ExpenseBreakdownChart` (gastos por categoría), seguidas por la tabla paginada `AccountingTransactionsTable` y el botón de descarga CSV (`/api/accounting/profit-report?format=csv`).

## Criterios de aceptación
- [ ] Si un usuario con rol `barbero` o `cliente` intenta ingresar a `/admin/contabilidad/ganancias` o a `/api/accounting/profit-report`, el acceso es denegado/redirigido y no puede ver los datos financieros.
- [ ] Las tarjetas de resumen (`ProfitSummaryCards`) muestran Ingresos Netos, Ganancia Bruta, Gastos Operativos y Ganancia Neta formateados en COP junto con su comparativa frente al periodo anterior.
- [ ] Al cambiar los filtros (por ejemplo elegir otro periodo rápido, servicio o barbero) y aplicarlos, las tarjetas KPI, las gráficas y la tabla de transacciones se actualizan con los datos de ese filtro.
- [ ] Al registrar un nuevo gasto operativo con fecha dentro del periodo consultado, concepto e importe mayor a cero, el total de **Gastos Operativos** aumenta en ese monto y la **Ganancia Neta** disminuye en la misma proporción.
- [ ] Al hacer clic en exportar CSV, el navegador descarga un archivo `.csv` con el resumen del periodo y las filas de transacciones filtradas.

## Fuera de alcance
Facturación electrónica ante la DIAN y conciliación bancaria automática con entidades financieras.
