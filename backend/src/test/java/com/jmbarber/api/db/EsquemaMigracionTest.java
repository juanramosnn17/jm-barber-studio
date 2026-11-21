package com.jmbarber.api.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Criterios de la tarea 4.2 (docs/tareas.md): la migración V1 crea el esquema,
 * carga las semillas y MySQL hace cumplir la regla de negocio de F2.
 * Cada prueba se revierte al terminar (@Transactional).
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class EsquemaMigracionTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void creaLasCincoTablasYCargaLasSemillas() {
        Integer tablas = jdbc.queryForObject(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() "
                + "AND table_name IN ('users','services','business_hours','appointments','expenses')",
            Integer.class);
        assertThat(tablas).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM services", Integer.class)).isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT open_days FROM business_hours WHERE id = 1", String.class))
            .isEqualTo("1,2,3,4,5,6");
    }

    @Test
    void unTurnoSoloAdmiteUnaCitaActiva() {
        String cliente = crearCliente();
        String servicio = jdbc.queryForObject("SELECT id FROM services ORDER BY sort_order LIMIT 1", String.class);

        crearCita(cliente, servicio, "CONFIRMADA");
        // Mismo turno, otra cita activa → MySQL la rechaza (índice único sobre active_slot)
        assertThatThrownBy(() -> crearCita(cliente, servicio, "CONFIRMADA"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void lasCitasCanceladasNoOcupanElTurno() {
        String cliente = crearCliente();
        String servicio = jdbc.queryForObject("SELECT id FROM services ORDER BY sort_order LIMIT 1", String.class);

        crearCita(cliente, servicio, "CANCELADA");
        crearCita(cliente, servicio, "CANCELADA");
        crearCita(cliente, servicio, "CONFIRMADA"); // el turno sigue libre
        Integer activas = jdbc.queryForObject(
            "SELECT COUNT(*) FROM appointments WHERE active_slot IS NOT NULL", Integer.class);
        assertThat(activas).isEqualTo(1);
    }

    @Test
    void laReservaNoPuedeSuperarElPrecio() {
        // MySQL rechaza con el error 3819 (CHECK); Spring lo reporta como DataAccessException genérica
        assertThatThrownBy(() -> jdbc.update(
            "UPDATE services SET reserve_amount = price + 1 ORDER BY sort_order LIMIT 1"))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("ck_services_reserve");
    }

    private String crearCliente() {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO users (id, first_name, email, password_hash) VALUES (?, 'Prueba', ?, 'x')",
            id, "prueba-" + id + "@example.com");
        return id;
    }

    private void crearCita(String cliente, String servicio, String estado) {
        jdbc.update("INSERT INTO appointments (id, client_id, service_id, date, time, end_time, status) "
                + "VALUES (?, ?, ?, '2030-01-15', '10:00:00', '10:40:00', ?)",
            UUID.randomUUID().toString(), cliente, servicio, estado);
    }
}
