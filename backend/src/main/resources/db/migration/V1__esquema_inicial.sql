-- =====================================================================
-- V1 · Esquema inicial de JM Barber Studio en MySQL (tarea 4.2)
-- Traducción de supabase/schema.sql con las reglas de docs/specs/F1..F5.
-- Regla Flyway: una migración aplicada NUNCA se edita; los cambios van en V2, V3…
-- =====================================================================

-- 1. Usuarios (reemplaza auth.users + profiles de Supabase)
CREATE TABLE users (
  id            CHAR(36)     NOT NULL,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL DEFAULT '',
  email         VARCHAR(160) NOT NULL,
  phone         VARCHAR(30)  NULL,
  password_hash VARCHAR(100) NOT NULL,                -- BCrypt; nunca la contraseña en texto plano
  role          ENUM('CLIENTE','BARBERO','ADMIN') NOT NULL DEFAULT 'CLIENTE',
  created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Servicios del catálogo, con reserva fija para gastos (tarea 3.27)
CREATE TABLE services (
  id               CHAR(36)      NOT NULL,
  name             VARCHAR(120)  NOT NULL,
  short_name       VARCHAR(60)   NOT NULL,
  description      TEXT          NOT NULL,
  includes         VARCHAR(255)  NULL,
  price            DECIMAL(10,2) NOT NULL,
  duration_label   VARCHAR(30)   NOT NULL,
  duration_minutes INT           NOT NULL DEFAULT 30,
  image_url        VARCHAR(255)  NULL,
  icon             VARCHAR(60)   NOT NULL DEFAULT 'content_cut',
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order       INT           NOT NULL DEFAULT 0,
  reserve_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT ck_services_price   CHECK (price >= 0),
  CONSTRAINT ck_services_reserve CHECK (reserve_amount >= 0 AND reserve_amount <= price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Horario de atención (una sola fila, id = 1)
CREATE TABLE business_hours (
  id           TINYINT     NOT NULL DEFAULT 1,
  open_days    VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5,6',   -- 0 = domingo … 6 = sábado
  open_time    TIME        NOT NULL DEFAULT '09:00:00',
  close_time   TIME        NOT NULL DEFAULT '20:00:00',
  break_start  TIME        NULL     DEFAULT '14:00:00',
  break_end    TIME        NULL     DEFAULT '15:00:00',
  slot_minutes INT         NOT NULL DEFAULT 30,
  PRIMARY KEY (id),
  CONSTRAINT ck_business_hours_single CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Citas, con su pago y la reserva fijada al completarla
CREATE TABLE appointments (
  id              CHAR(36)      NOT NULL,
  client_id       CHAR(36)      NOT NULL,
  service_id      CHAR(36)      NOT NULL,
  date            DATE          NOT NULL,
  time            TIME          NOT NULL,
  status          ENUM('PENDIENTE','CONFIRMADA','EN_CURSO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  notes           VARCHAR(500)  NULL,
  payment_status  ENUM('PENDIENTE','PAGADO','REEMBOLSADO','ANULADO') NOT NULL DEFAULT 'PENDIENTE',
  payment_method  ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI_DAVIPLATA') NULL,
  gross_amount    DECIMAL(10,2) NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  refund_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  tip_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  reserve_amount  DECIMAL(10,2) NULL,
  paid_at         DATETIME(6)   NULL,
  created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  -- Regla F2: una sola cita no cancelada por (fecha, hora). MySQL no tiene índices
  -- parciales: esta columna vale "fecha hora" si la cita está activa y NULL si está
  -- cancelada; el índice UNIQUE admite varios NULL.
  active_slot     VARCHAR(19) GENERATED ALWAYS AS
                    (IF(status <> 'CANCELADA', CONCAT(date, ' ', time), NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_appointments_active_slot (active_slot),
  KEY idx_appointments_date (date),
  KEY idx_appointments_client (client_id),
  CONSTRAINT fk_appointments_client  FOREIGN KEY (client_id)  REFERENCES users (id)    ON DELETE CASCADE,
  CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT,
  CONSTRAINT ck_appointments_amounts CHECK (discount_amount >= 0 AND refund_amount >= 0 AND tip_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Gastos operativos (se pagan con la reserva del negocio)
CREATE TABLE expenses (
  id             CHAR(36)      NOT NULL,
  date           DATE          NOT NULL,
  time           TIME          NOT NULL DEFAULT '12:00:00',
  category       ENUM('ARRIENDO','SERVICIOS_PUBLICOS','NOMINA_ADMINISTRATIVA','INSUMOS_GENERALES',
                      'COMPRA_INSUMOS_PRODUCTOS','PUBLICIDAD','MANTENIMIENTO','OTROS') NOT NULL,
  concept        VARCHAR(200)  NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  payment_method ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI_DAVIPLATA') NOT NULL DEFAULT 'TRANSFERENCIA',
  status         ENUM('REGISTRADO','ANULADO') NOT NULL DEFAULT 'REGISTRADO',
  reference      VARCHAR(120)  NULL,
  notes          VARCHAR(500)  NULL,
  void_reason    VARCHAR(300)  NULL,
  voided_at      DATETIME(6)   NULL,
  created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_expenses_date (date),
  CONSTRAINT ck_expenses_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Datos semilla: horario y los 6 servicios del catálogo actual
INSERT INTO business_hours (id) VALUES (1);

INSERT INTO services (id, name, short_name, description, includes, price, duration_label, duration_minutes, image_url, icon, is_active, sort_order) VALUES
  (UUID(), 'Corte de cabello', 'Corte de cabello', 'Corte técnico personalizado a tijera y máquina según morfología facial, incluye lavado revitalizante, tónico de cuero cabelludo y peinado final.', 'Lavado + Peinado + Asesoría rápida', 25000, '35-40 min', 40, '/images/servicios/corte-cabello.jpg', 'content_cut', TRUE, 1),
  (UUID(), 'Arreglo de barba', 'Corte de barba', 'Perfilado milimétrico con navaja clásica, tratamiento con toallas calientes aromáticas e hidratación intensiva con aceites orgánicos.', 'Toalla caliente + Aceites esenciales', 18000, '25-30 min', 30, '/images/servicios/arreglo-barba.jpg', 'face', TRUE, 2),
  (UUID(), 'Arreglo de cejas', 'Arreglo de cejas', 'Diseño, definición y limpieza de cejas respetando la armonía de la mirada mediante técnica combinada de navaja y tijera de precisión.', 'Perfilado con navaja + Fijación', 10000, '15 min', 15, '/images/servicios/arreglo-cejas.jpg', 'brush', TRUE, 3),
  (UUID(), 'Corte Pro (Cabello + Barba)', 'Corte Pro', 'Servicio combinado de corte técnico integral a tijera y máquina con perfilado y ritual de toalla caliente para barba.', 'Cabello + Barba completa + Toalla caliente', 38000, '50-60 min', 60, '/images/servicios/corte-pro.jpg', 'stars', TRUE, 4),
  (UUID(), 'Corte Pro Max (Cabello + Barba + Cejas)', 'Corte Pro Max', 'Experiencia total de cuidado facial y capilar: corte completo, diseño integral de barba con toalla caliente infusionada y limpieza precisa de cejas.', 'Cabello + Barba + Cejas + Toalla aromática', 45000, '65-75 min', 75, '/images/servicios/corte-pro-max.jpg', 'workspace_premium', TRUE, 5),
  (UUID(), 'Corte Ultra Pro Max', 'Corte Ultra Pro Max', 'El ritual insignia definitivo: corte morfológico a medida, barba con doble toalla y vapor, cejas, más asesoría personalizada de imagen y estilismo exclusivo.', 'Corte + Barba + Cejas + Asesoría de Imagen', 60000, '80-90 min', 90, '/images/servicios/arreglo-cejas.jpg', 'diamond', TRUE, 6);
