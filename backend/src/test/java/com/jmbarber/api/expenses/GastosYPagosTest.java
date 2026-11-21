package com.jmbarber.api.expenses;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
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

/** Criterios de la tarea 4.7 (spec F5: gastos y ajuste de pagos; tareas 3.23–3.26 y 3.29). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class GastosYPagosTest {

    @Autowired private MockMvc mvc;
    @Autowired private TokenService tokens;
    @Autowired private UserRepository users;
    @Autowired private BarberServiceRepository services;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;

    private final LocalDate monday = LocalDate.now(TimeConfig.STUDIO_ZONE).plusDays(7)
        .with(TemporalAdjusters.next(DayOfWeek.MONDAY));

    private String admin;
    private String barbero;
    private String cliente;
    private BarberService corte;

    @BeforeEach
    void datos() {
        admin = token(Role.ADMIN);
        barbero = token(Role.BARBERO);
        cliente = token(Role.CLIENTE);
        corte = services.findByActiveTrueOrderBySortOrderAsc().get(0); // Corte de cabello, 25.000
    }

    // ---------- Gastos ----------

    @Test
    void registrarGastoConValoresPorDefectoYCategoriaDeCompras() throws Exception {
        gasto(post("/api/v1/expenses"), admin, """
                {"date":"2026-11-02","concept":"  Arriendo noviembre ","amount":800000.4}""")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("REGISTRADO"))
            .andExpect(jsonPath("$.concept").value("Arriendo noviembre"))
            .andExpect(jsonPath("$.amount").value(800000))
            .andExpect(jsonPath("$.time").value("12:00"))
            .andExpect(jsonPath("$.category").value("OTROS"))
            .andExpect(jsonPath("$.paymentMethod").value("TRANSFERENCIA"));

        gasto(post("/api/v1/expenses"), admin, """
                {"date":"2026-11-03","time":"09:15","category":"COMPRA_INSUMOS_PRODUCTOS","concept":"Ceras",
                 "amount":45000,"paymentMethod":"EFECTIVO","reference":"Factura 12"}""")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.category").value("COMPRA_INSUMOS_PRODUCTOS"))
            .andExpect(jsonPath("$.reference").value("Factura 12"));
    }

    @Test
    void gastoIncompletoOConImporteCeroResponde400() throws Exception {
        String required = "Por favor ingresa fecha, concepto y un importe mayor a cero.";
        gasto(post("/api/v1/expenses"), admin, "{\"concept\":\"Luz\",\"amount\":1000}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(required));
        gasto(post("/api/v1/expenses"), admin, "{\"date\":\"2026-11-02\",\"concept\":\" \",\"amount\":1000}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(required));
        gasto(post("/api/v1/expenses"), admin, "{\"date\":\"2026-11-02\",\"concept\":\"Luz\",\"amount\":0.3}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(required));
        gasto(post("/api/v1/expenses"), admin,
                "{\"date\":\"2026-11-02\",\"concept\":\"Luz\",\"amount\":1000,\"category\":\"VIAJES\"}")
            .andExpect(status().isBadRequest());
    }

    @Test
    void editarAnularYNoEditarUnGastoAnulado() throws Exception {
        String id = idDe(gasto(post("/api/v1/expenses"), admin,
            "{\"date\":\"2026-11-02\",\"concept\":\"Agua\",\"amount\":60000}").andExpect(status().isCreated()));

        gasto(put("/api/v1/expenses/{id}", id), admin, """
                {"date":"2026-11-04","concept":"Agua y luz","amount":95000,"category":"SERVICIOS_PUBLICOS"}""")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.amount").value(95000))
            .andExpect(jsonPath("$.category").value("SERVICIOS_PUBLICOS"));

        gasto(post("/api/v1/expenses/{id}/void", id), admin, "{\"reason\":\" \"}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Escribe el motivo de la anulación."));
        gasto(post("/api/v1/expenses/{id}/void", id), admin, "{\"reason\":\"Registrado dos veces\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ANULADO"))
            .andExpect(jsonPath("$.voidReason").value("Registrado dos veces"))
            .andExpect(jsonPath("$.voidedAt").isNotEmpty());

        gasto(post("/api/v1/expenses/{id}/void", id), admin, "{\"reason\":\"Otra vez\"}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(ExpenseService.ALREADY_VOIDED));
        gasto(put("/api/v1/expenses/{id}", id), admin, "{\"date\":\"2026-11-04\",\"concept\":\"X\",\"amount\":1}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(ExpenseService.VOIDED_CANNOT_EDIT));
    }

    @Test
    void eliminarGastoLoBorraSinRastro() throws Exception {
        String id = idDe(gasto(post("/api/v1/expenses"), admin,
            "{\"date\":\"2026-11-02\",\"concept\":\"Error\",\"amount\":1000}").andExpect(status().isCreated()));

        mvc.perform(delete("/api/v1/expenses/{id}", id).header("Authorization", admin))
            .andExpect(status().isNoContent());
        em.flush();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM expenses WHERE id = ?", Integer.class, id)).isZero();
        mvc.perform(delete("/api/v1/expenses/{id}", id).header("Authorization", admin))
            .andExpect(status().isNotFound());
    }

    @Test
    void soloElAdminManejaGastos() throws Exception {
        String body = "{\"date\":\"2026-11-02\",\"concept\":\"Intento\",\"amount\":1000}";
        gasto(post("/api/v1/expenses"), barbero, body).andExpect(status().isForbidden());
        gasto(post("/api/v1/expenses"), cliente, body).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/expenses").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
    }

    // ---------- Ajuste de pago de citas ----------

    @Test
    void ajustarPagoDeCitaCompletadaConPropinaAparte() throws Exception {
        String id = citaCompletada("10:00");

        pago(admin, id, "TRANSFERENCIA", 5000, 0, 3000)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paymentStatus").value("PAGADO"))
            .andExpect(jsonPath("$.paymentMethod").value("TRANSFERENCIA"))
            .andExpect(jsonPath("$.grossAmount").value(25000))
            .andExpect(jsonPath("$.netAmount").value(20000))
            .andExpect(jsonPath("$.tipAmount").value(3000));

        pago(admin, id, "NEQUI_DAVIPLATA", 0, 25000, 0)
            .andExpect(jsonPath("$.paymentStatus").value("REEMBOLSADO"))
            .andExpect(jsonPath("$.netAmount").value(0));

        em.flush();
        assertThat(jdbc.queryForObject("SELECT refund_amount FROM appointments WHERE id = ?", BigDecimal.class, id))
            .isEqualByComparingTo("25000");
    }

    @Test
    void erroresAlAjustarElPago() throws Exception {
        String id = citaCompletada("11:00");
        pago(admin, id, "EFECTIVO", 20000, 5001, 0)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("El descuento y el reembolso no pueden superar el valor del servicio."));
        pago(admin, id, "EFECTIVO", -1, 0, 0).andExpect(status().isBadRequest());
        pago(admin, id, "EFECTIVO", 0, 0, -500)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("La propina no puede ser negativa."));
        pago(barbero, id, "EFECTIVO", 0, 0, 0).andExpect(status().isForbidden());

        String pendiente = idDe(reservar("12:00"));
        pago(admin, pendiente, "EFECTIVO", 0, 0, 0)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("NOT_COMPLETED"))
            .andExpect(jsonPath("$.message").value("Solo se puede ajustar el pago de una cita completada."));
        pago(admin, UUID.randomUUID().toString(), "EFECTIVO", 0, 0, 0).andExpect(status().isNotFound());
    }

    @Test
    void siLaCitaDejaDeEstarCompletadaSeBorranLosAjustes() throws Exception {
        String id = citaCompletada("16:00");
        pago(admin, id, "TARJETA", 2000, 1000, 4000).andExpect(status().isOk());

        estado(admin, id, "EN_CURSO").andExpect(status().isOk());
        em.flush();
        assertThat(jdbc.queryForObject("SELECT tip_amount + discount_amount + refund_amount FROM appointments WHERE id = ?",
            BigDecimal.class, id)).isEqualByComparingTo("0");
    }

    // ---------- Ayudas ----------

    private String token(Role role) {
        String email = role.name().toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        User user = User.newClient("Prueba", role.name(), email, null, "$2a$10$sin-uso-en-esta-prueba");
        user.setRole(role);
        return "Bearer " + tokens.issue(users.save(user));
    }

    private ResultActions gasto(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                                String auth, String body) throws Exception {
        return mvc.perform(request.header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions reservar(String time) throws Exception {
        return mvc.perform(post("/api/v1/appointments").header("Authorization", cliente)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"serviceId\":\"%s\",\"date\":\"%s\",\"time\":\"%s\"}".formatted(corte.getId(), monday, time)))
            .andExpect(status().isCreated());
    }

    private String citaCompletada(String time) throws Exception {
        String id = idDe(reservar(time));
        estado(barbero, id, "COMPLETADA").andExpect(status().isOk());
        return id;
    }

    private ResultActions estado(String auth, String id, String newStatus) throws Exception {
        return mvc.perform(patch("/api/v1/appointments/{id}/status", id).header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"%s\"}".formatted(newStatus)));
    }

    private ResultActions pago(String auth, String id, String method, int discount, int refund, int tip)
        throws Exception {
        return mvc.perform(patch("/api/v1/appointments/{id}/payment", id).header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"paymentMethod":"%s","discountAmount":%d,"refundAmount":%d,"tipAmount":%d}"""
                .formatted(method, discount, refund, tip)));
    }

    private static String idDe(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getContentAsString().replaceAll("^\\{\"id\":\"([^\"]+)\".*", "$1");
    }
}
