# Producto · JM Barber Studio

## Problema
La asignación manual de citas por redes sociales o WhatsApp genera cruces de horarios (overbooking), tiempos muertos sin control y pérdida de clientes. Además, registrar manualmente los ingresos por corte, comisiones de barberos, costos de insumos y gastos operativos diarios dificulta conocer la ganancia neta real del negocio.

## Usuario
1. **Clientes:** Hombres que buscan agendar su corte de cabello, arreglo de barba o cejas de forma rápida y autónoma desde el celular o computador, viendo la disponibilidad real.
2. **Barberos:** Profesionales del estudio que necesitan consultar las citas confirmadas del día, conocer qué servicio realizarán y en qué sillón atenderán.
3. **Administrador (Director del Estudio):** Dueño o encargado que organiza la agenda diaria, administra el catálogo de servicios, configura los horarios de atención, gestiona los usuarios/roles y audita el estado financiero y las ganancias netas.

## Objetivo del MVP
Que un cliente pueda registrarse y asegurar su espacio en la agenda en menos de 1 minuto sin intervención humana ni cruces de horario, y que el administrador pueda gestionar la operación diaria (citas, horarios, servicios y usuarios) y consultar sus ganancias netas y reportes contables desde un panel de control centralizado.

## Funcionalidades (ver `docs/specs/`)
- **F1 · Catálogo público y autenticación por roles:** Visualización de servicios activos en la portada, registro de clientes e inicio de sesión con redirección según rol (`cliente`, `barbero`, `admin`).
- **F2 · Reserva de citas y área del cliente:** Flujo guiado de 4 pasos (servicio, fecha, hora libre según horario laboral y confirmación) y tarjeta de próxima cita activa.
- **F3 · Gestión operativa de agenda diaria (Admin/Barbero):** Tablero con KPIs del día, filtro por estado, cambio de estado de citas (`confirmada`, `completada`, `cancelada`). La asignación de barbero y sillón queda pospuesta mientras haya un solo barbero.
- **F4 · Administración de servicios, horarios y usuarios:** Activación/creación de servicios del catálogo, configuración de días/horas laborables y pausa de almuerzo, y gestión paginada de usuarios y roles.
- **F5 · Módulo contable y reporte de ganancias:** Cálculo de ingresos brutos/netos, costos directos, comisiones, registro de gastos operativos, gráficas de tendencia/desglose, tabla auditable de transacciones y exportación CSV.

## Fuera del MVP
Pagos en línea con tarjeta de crédito o pasarela de pago por adelantado, envío automatizado de recordatorios por API de WhatsApp/SMS, programa de puntos o fidelización de clientes y aplicación móvil nativa (iOS/Android).

## Cómo sabremos que funciona
- El 100% de las reservas creadas desde `/cliente` bloquean inmediatamente el turno elegido para evitar cruces de horario en la misma fecha y hora.
- Al marcar una cita como `completada` o registrar un gasto operativo en `/admin`, el reporte en `/admin/contabilidad/ganancias` actualiza de forma exacta la ganancia bruta y neta del periodo y permite exportar la sábana de transacciones en CSV.
- **Con el backend en Supabase:** el 100% de las citas, gastos y cambios de configuración se conservan al recargar, al entrar desde otro dispositivo y después de un nuevo despliegue.
- **Con el backend en Supabase:** cero citas no canceladas con la misma fecha y hora en la tabla `appointments`, y ningún cliente puede ver citas o datos de otro cliente.
