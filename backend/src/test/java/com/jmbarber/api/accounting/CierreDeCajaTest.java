package com.jmbarber.api.accounting;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.auth.TokenService;
import com.jmbarber.api.common.TimeConfig;
import com.jmbarber.api.services.BarberService;
import com.jmbarber.api.services.BarberServiceRepository;
import com.jmbarber.api.users.Role;
import com.jmbarber.api.users.User;
import com.jmbarber.api.users.UserRepository;

/** Criterios de la tarea 3.31 (spec F5): cierre de caja del día por método de pago. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CierreDeCajaTest {

    private static final String DIA = "2020-06-15";

    @Autowired private MockMvc mvc;
    @Autowired private TokenService tokens;
    @Autowired private UserRepository users;
    @Autowired private BarberServiceRepository services;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;

    private String admin;
    private User cliente;
    private BarberService corte;

    @BeforeEach
    void datos() {
        admin = bearer(crear("Admin", Role.ADMIN));
        cliente = crear("Ana", Role.CLIENTE);
        corte = services.findByActiveTrueOrderBySortOrderAsc().get(0);
        em.flush();
    }

    @Test
    void ejemploDeLaSpecEfectivoNequiYGastoEnEfectivo() throws Exception {
        cita(DIA, "09:00", "EFECTIVO", 25000, 0, 0);
        cita(DIA, "10:00", "NEQUI_DAVIPLATA", 20000, 0, 0);
        gasto(DIA, "EFECTIVO", 5000, "REGISTRADO");

        cierre(DIA)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.date").value(DIA))
            .andExpect(jsonPath("$.expectedCash").value(20000))
            .andExpect(jsonPath("$.methods[*].paymentMethod",
                contains("EFECTIVO", "NEQUI_DAVIPLATA", "TRANSFERENCIA", "TARJETA")))
            .andExpect(jsonPath("$.methods[0].income").value(25000))
            .andExpect(jsonPath("$.methods[0].expenses").value(5000))
            .andExpect(jsonPath("$.methods[1].balance").value(20000))
            .andExpect(jsonPath("$.methods[2].balance").value(0))
            .andExpect(jsonPath("$.totals.income").value(45000))
            .andExpect(jsonPath("$.totals.expenses").value(5000));
    }

    @Test
    void propinasDescuentosYVentasDeProductosPorMetodo() throws Exception {
        cita(DIA, "09:00", "EFECTIVO", 25000, 5000, 3000);    // neto 20.000 + propina 3.000
        cita(DIA, "10:00", "TARJETA", 25000, 0, 2000);
        venta(DIA, "EFECTIVO", 18000, "REGISTRADO");
        venta(DIA, "TRANSFERENCIA", 12000, "REGISTRADO");

        cierre(DIA)
            .andExpect(jsonPath("$.methods[0].income").value(38000))   // 20.000 + 18.000
            .andExpect(jsonPath("$.methods[0].tips").value(3000))
            .andExpect(jsonPath("$.expectedCash").value(41000))         // la propina en efectivo queda en caja
            .andExpect(jsonPath("$.methods[2].income").value(12000))
            .andExpect(jsonPath("$.methods[3].balance").value(27000))
            .andExpect(jsonPath("$.totals.tips").value(5000));
    }

    @Test
    void anuladosYOtrosDiasNoCuentan() throws Exception {
        cita(DIA, "09:00", "EFECTIVO", 25000, 0, 0);
        cita("2020-06-16", "09:00", "EFECTIVO", 25000, 0, 0);
        venta(DIA, "EFECTIVO", 18000, "ANULADO");
        gasto(DIA, "EFECTIVO", 9000, "ANULADO");
        jdbc.update("""
            INSERT INTO appointments (id, client_id, service_id, date, time, status, payment_status, payment_method, gross_amount)
            VALUES (?, ?, ?, ?, '11:00', 'COMPLETADA', 'ANULADO', 'EFECTIVO', 25000)""",
            UUID.randomUUID().toString(), cliente.getId(), corte.getId(), DIA);

        cierre(DIA).andExpect(jsonPath("$.expectedCash").value(25000));
    }

    @Test
    void gastosMayoresQueLoCobradoDejanCajaNegativa() throws Exception {
        gasto(DIA, "EFECTIVO", 30000, "REGISTRADO");
        cierre(DIA).andExpect(jsonPath("$.expectedCash").value(-30000));
    }

    @Test
    void sinFechaEsHoyYFechaInvalidaResponde400() throws Exception {
        mvc.perform(get("/api/v1/accounting/cash-closing").header("Authorization", admin))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.date").value(LocalDate.now(TimeConfig.STUDIO_ZONE).toString()));
        cierre("15-06-2020").andExpect(status().isBadRequest());
    }

    @Test
    void barberoYClienteNoVenElCierre() throws Exception {
        for (Role role : new Role[] {Role.BARBERO, Role.CLIENTE}) {
            mvc.perform(get("/api/v1/accounting/cash-closing").header("Authorization", bearer(crear("Otro", role))))
                .andExpect(status().isForbidden());
        }
    }

    // ---------- Ayudas ----------

    private User crear(String firstName, Role role) {
        String email = firstName.toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        User user = User.newClient(firstName, "Prueba", email, null, "$2a$10$sin-uso-en-esta-prueba");
        user.setRole(role);
        return users.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + tokens.issue(user);
    }

    private ResultActions cierre(String date) throws Exception {
        return mvc.perform(get("/api/v1/accounting/cash-closing").param("date", date).header("Authorization", admin));
    }

    private void cita(String date, String time, String method, int gross, int discount, int tip) {
        jdbc.update("""
            INSERT INTO appointments (id, client_id, service_id, date, time, status, payment_status, payment_method,
                                      gross_amount, discount_amount, tip_amount, reserve_amount)
            VALUES (?, ?, ?, ?, ?, 'COMPLETADA', 'PAGADO', ?, ?, ?, ?, 0)""",
            UUID.randomUUID().toString(), cliente.getId(), corte.getId(), date, time, method, gross, discount, tip);
    }

    private void venta(String date, String method, int amount, String status) {
        jdbc.update("""
            INSERT INTO product_sales (id, date, concept, amount, payment_method, status)
            VALUES (?, ?, 'Producto', ?, ?, ?)""", UUID.randomUUID().toString(), date, amount, method, status);
    }

    private void gasto(String date, String method, int amount, String status) {
        jdbc.update("""
            INSERT INTO expenses (id, date, category, concept, amount, payment_method, status)
            VALUES (?, ?, 'OTROS', 'Gasto', ?, ?, ?)""", UUID.randomUUID().toString(), date, amount, method, status);
    }
}
