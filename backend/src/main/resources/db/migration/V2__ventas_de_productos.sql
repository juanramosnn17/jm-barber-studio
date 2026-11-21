-- =====================================================================
-- V2 · Ventas de productos (tarea 3.30, spec F5)
-- Suman a Ingresos y a Tu ganancia; no apartan reserva. Se anulan con
-- motivo (dejan de sumar y se conservan) o se eliminan, igual que un gasto.
-- =====================================================================
CREATE TABLE product_sales (
  id             CHAR(36)      NOT NULL,
  date           DATE          NOT NULL,
  time           TIME          NOT NULL DEFAULT '12:00:00',
  concept        VARCHAR(200)  NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  payment_method ENUM('EFECTIVO','TRANSFERENCIA','TARJETA','NEQUI_DAVIPLATA') NOT NULL DEFAULT 'EFECTIVO',
  status         ENUM('REGISTRADO','ANULADO') NOT NULL DEFAULT 'REGISTRADO',
  void_reason    VARCHAR(300)  NULL,
  voided_at      DATETIME(6)   NULL,
  created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_product_sales_date (date),
  CONSTRAINT ck_product_sales_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
