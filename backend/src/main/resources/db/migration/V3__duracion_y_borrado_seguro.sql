-- =====================================================================
-- V3 · Duración real de las citas y borrado seguro de usuarios (tarea 4.12)
-- Fuente: docs/datos/modelo.md + docs/contratos/api-rest.md §9.
-- Regla Flyway: V1 y V2 ya aplicadas no se editan; todo cambio va aquí.
-- =====================================================================

-- 1. Fin de la cita congelado al reservar: end_time = time + duración del servicio.
--    Las citas existentes se completan con la duración actual de su servicio.
ALTER TABLE appointments ADD COLUMN end_time TIME NULL AFTER time;

UPDATE appointments a
JOIN services s ON s.id = a.service_id
SET a.end_time = ADDTIME(a.time, SEC_TO_TIME(s.duration_minutes * 60));

ALTER TABLE appointments
  MODIFY end_time TIME NOT NULL,
  ADD CONSTRAINT ck_appointments_end_after_start CHECK (end_time > time);

-- 2. Borrar un usuario conserva el historial contable: sus citas quedan con
--    client_id = NULL ("Cliente eliminado"). Las futuras activas las cancela
--    el servidor antes de borrar (UserAdminService), para liberar los turnos.
ALTER TABLE appointments DROP FOREIGN KEY fk_appointments_client;

ALTER TABLE appointments MODIFY client_id CHAR(36) NULL;

ALTER TABLE appointments
  ADD CONSTRAINT fk_appointments_client
  FOREIGN KEY (client_id) REFERENCES users (id) ON DELETE SET NULL;
