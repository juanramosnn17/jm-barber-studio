# F5 · Módulo contable y reporte de ganancias

## Historia
Como administrador exclusivo del estudio, quiero consultar el reporte financiero detallado por rango de fechas, registrar gastos operativos y auditar cada transacción de ingreso o egreso (con opción de exportar a CSV), para conocer con exactitud la ganancia bruta y neta del negocio.

## Modelo contable de la barbería (rediseño, tareas 3.27–3.31)
> El dueño es el único barbero: **no hay comisión** ni costo de insumos escondido por servicio. En su lugar, cada servicio aparta una **reserva fija** para pagar los gastos del negocio.

| Concepto | Cómo se calcula |
|---|---|
| **Ingresos** | Servicios cobrados (precio − descuento − reembolso) + **ventas de productos** |
| **Reserva del negocio** | Suma del **monto de reserva** de cada servicio cobrado. El monto se define por servicio en `/admin/servicios` (ej.: Corte $5.000) y queda **fijado en la cita** al completarla, para que cambiar el monto después no altere el historial |
| **Tu ganancia** | Ingresos − Reserva del negocio |
| **Gastos** | Arriendo, servicios públicos, compras de insumos/productos, publicidad, mantenimiento, otros. **Se pagan con la reserva** |
| **Saldo de la reserva** | Reserva del negocio − Gastos. Si es negativo, la reserva no alcanzó y se muestra en rojo |
| **Propinas** | Se registran por cita y se muestran **aparte**; no suman a ingresos ni a la reserva |

**Pantalla simplificada (3.28):** sin gráficas ni desgloses por servicio, barbero o método (ese desglose va en el cierre de caja), sin comparativas con el periodo anterior. 5 tarjetas (Ingresos · Tu ganancia · Reserva del negocio · Gastos · Saldo de la reserva), más "Servicios realizados" y "Ticket promedio" como datos secundarios. Sin nada de "barbero", sin márgenes %, sin filtro de estado de pago. Periodos: Hoy, Esta semana, Mes actual, Mes anterior y Personalizado. Tabla de 6 columnas (Fecha · Concepto · Método de pago · Ingreso · Gasto · Estado) donde **toda la fila abre el detalle**, con el nombre real del cliente. La tabla solo lista citas cobradas y gastos (las citas pendientes o canceladas no son movimientos de dinero). El menú lateral no repite el perfil ni "Vista de Cliente", que están en el encabezado.

**Cierre de caja (3.31):** para un día, muestra lo cobrado por cada método de pago (efectivo, Nequi/Daviplata, transferencia, tarjeta), las propinas, los gastos pagados en efectivo y **el efectivo que debe haber en caja**.

## Comportamiento
1. La ruta `/admin/contabilidad/ganancias` verifica en el servidor que el usuario tenga rol estricto `admin` (si es `barbero` lo redirige a `/admin` y si es `cliente` a `/cliente`).
2. En la parte superior incluye un formulario desplegable/modal que invoca `createExpenseAction` para registrar nuevos **gastos operativos** (fecha, categoría como arriendo, servicios públicos, nómina, insumos, publicidad, mantenimiento u otros, concepto, monto en COP, método de pago y referencia).
3. El componente `ProfitReportFilters` permite filtrar el reporte por periodos rápidos (`today`, `7d`, `30d`, `month`, `custom`), rango de fechas (`startDate`, `endDate`), barbero, servicio, método de pago, estado de pago y categoría de gasto.
4. El motor contable (`lib/accounting/`) calcula y muestra en `ProfitSummaryCards`: Ingresos Netos, Costos Directos + Comisiones, Ganancia Bruta, Gastos Operativos y **Ganancia Neta** (con porcentaje de variación frente al periodo anterior equivalente).
5. Muestra visualizaciones en `ProfitTrendChart` (evolución temporal), `RevenueBreakdownChart` (ingresos por servicio, barbero y medio de pago) y `ExpenseBreakdownChart` (gastos por categoría), seguidas por la tabla paginada `AccountingTransactionsTable` y el botón de descarga CSV (`/api/accounting/profit-report?format=csv`).
6. **Ajustes contables (solo admin):** al abrir un movimiento en la tabla se muestra su "Comprobante Auditable" con acciones según el tipo:
   - **Gasto registrado:** *Editar* (fecha, categoría, concepto, monto, método de pago y referencia), *Anular* (con motivo obligatorio) y *Eliminar*.
   - **Gasto anulado:** muestra el motivo y la fecha de anulación; solo permite *Eliminar*.
   - **Cita completada:** *Ajustar pago* (método de pago, descuento y reembolso).
   - **Anular** es la forma recomendada de corregir: el gasto queda visible como "Anulado", con su motivo, y deja de sumar. **Eliminar** borra el registro sin rastro y se reserva para datos de prueba o errores evidentes; pide confirmación explícita.

## Criterios de aceptación
- [ ] Si un usuario con rol `barbero` o `cliente` intenta ingresar a `/admin/contabilidad/ganancias` o a `/api/accounting/profit-report`, el acceso es denegado/redirigido y no puede ver los datos financieros.
- [ ] Las tarjetas de resumen (`ProfitSummaryCards`) muestran Ingresos Netos, Ganancia Bruta, Gastos Operativos y Ganancia Neta formateados en COP junto con su comparativa frente al periodo anterior.
- [ ] Al cambiar los filtros (por ejemplo elegir otro periodo rápido, servicio o barbero) y aplicarlos, las tarjetas KPI, las gráficas y la tabla de transacciones se actualizan con los datos de ese filtro.
- [ ] Al registrar un nuevo gasto operativo con fecha dentro del periodo consultado, concepto e importe mayor a cero, el total de **Gastos Operativos** aumenta en ese monto y la **Ganancia Neta** disminuye en la misma proporción.
- [ ] Al hacer clic en exportar CSV, el navegador descarga un archivo `.csv` con el resumen del periodo y las filas de transacciones filtradas.
- [ ] **Anular gasto:** al anular un gasto registrado escribiendo un motivo, su estado pasa a "Anulado", el total de **Gastos Operativos** baja en su monto, y el comprobante muestra el motivo y la fecha de anulación. Sin motivo, no se permite anular.
- [ ] **Editar gasto:** al cambiar el monto de un gasto registrado (por ejemplo de $1.000 a $2.000) y guardar, el total de Gastos Operativos refleja el nuevo monto. Un gasto anulado no se puede editar.
- [ ] **Eliminar gasto:** tras confirmar, el gasto desaparece de la tabla y de los totales, también al recargar.
- [ ] **Ajustar pago de una cita:** en una cita completada se puede cambiar el método de pago y registrar descuento y/o reembolso; el Ingreso Neto de esa cita pasa a ser precio − descuento − reembolso. Si descuento + reembolso superan el precio, se rechaza con el mensaje `"El descuento y el reembolso no pueden superar el valor del servicio."`.
- [ ] Un `barbero` o `cliente` no puede ejecutar ninguno de estos ajustes (el servidor responde "No tienes permisos para realizar esta acción.").

### Criterios del modelo de reserva (tareas 3.27–3.31)
- [ ] **3.27 Reserva:** en `/admin/servicios` cada servicio muestra y permite editar su **monto de reserva**. Al completar una cita de un servicio con reserva $5.000 y precio $25.000, el reporte suma $25.000 a Ingresos, $5.000 a Reserva del negocio y $20.000 a Tu ganancia; **no se descuenta ninguna comisión**.
- [ ] **3.27 Historial:** si después se cambia la reserva del servicio a $6.000, las citas ya completadas siguen sumando $5.000.
- [ ] **3.27 Saldo:** con $10.000 de reserva y un gasto de $12.000 en el periodo, el Saldo de la reserva muestra −$12.000 + $10.000 = **−$2.000 en rojo**.
- [ ] **3.28 Pantalla:** la contabilidad muestra solo las 5 tarjetas principales, no muestra nada de "barbero" ni márgenes %, y al pulsar cualquier parte de una fila se abre su detalle.
- [ ] **3.29 Compras:** al registrar un gasto existe la categoría "Compra de insumos / productos".
- [ ] **3.29 Propinas:** al ajustar el pago de una cita completada se puede registrar una propina; aparece en "Propinas" y **no** cambia Ingresos ni Reserva.
- [ ] **3.30 Productos:** al registrar una venta de producto (concepto, monto, método de pago) los Ingresos y Tu ganancia suben en ese monto; la venta se puede anular o eliminar como un gasto.
- [ ] **3.31 Cierre de caja:** para un día con $25.000 en efectivo, $20.000 por Nequi y un gasto de $5.000 pagado en efectivo, el cierre muestra efectivo en caja **$20.000** y Nequi $20.000.

### Criterios con Supabase conectado [Back]
- [ ] [Back] Un gasto registrado sigue apareciendo en el reporte después de recargar y de entrar desde otro navegador.
- [ ] [Back] Una cita marcada como `completada` en `/admin` aparece como ingreso en el reporte del periodo que la contiene.
- [ ] [Back] Una anulación, edición, eliminación o ajuste de pago se conserva al recargar y al entrar desde otro navegador.

## Fuera de alcance
Facturación electrónica ante la DIAN y conciliación bancaria automática con entidades financieras.
