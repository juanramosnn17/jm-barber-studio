package com.jmbarber.api.sales;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
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
import com.jmbarber.api.services.BarberService;
import com.jmbarber.api.services.BarberServiceRepository;
import com.jmbarber.api.users.Role;
import com.jmbarber.api.users.User;
import com.jmbarber.api.users.UserRepository;

/** Criterios de la tarea 3.30 (spec F5): venta de productos y su efecto en el reporte. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class VentasDeProductosTest {

    private static final String MAYO = "period=custom&startDate=2020-05-01&endDate=2020-05-31";

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
        corte = services.findByActiveTrueOrderBySortOrderAsc().get(0); // Corte de cabello, 25.000
        em.flush();
    }

    @Test
    void registrarVentaConValoresPorDefecto() throws Exception {
        venta("{\"date\":\"2020-05-04\",\"concept\":\"  Cera para cabello \",\"amount\":18000.4}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.concept").value("Cera para cabello"))
            .andExpect(jsonPath("$.amount").value(18000))
            .andExpect(jsonPath("$.time").value("12:00"))
            .andExpect(jsonPath("$.paymentMethod").value("EFECTIVO"))
            .andExpect(jsonPath("$.status").value("REGISTRADO"));
    }

    @Test
    void ventaIncompletaOConImporteCeroResponde400() throws Exception {
        String required = "Por favor ingresa fecha, producto y un importe mayor a cero.";
        venta("{\"concept\":\"Gel\",\"amount\":1000}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(required));
        venta("{\"date\":\"2020-05-04\",\"concept\":\"\",\"amount\":1000}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(required));
        venta("{\"date\":\"2020-05-04\",\"concept\":\"Gel\",\"amount\":0}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(required));
        venta("{\"date\":\"2020-05-04\",\"concept\":\"Gel\",\"amount\":1000,\"paymentMethod\":\"BITCOIN\"}")
            .andExpect(status().isBadRequest());
    }

    @Test
    void anularConMotivoYEliminarComoUnGasto() throws Exception {
        String id = idDe(venta("{\"date\":\"2020-05-04\",\"concept\":\"Gel\",\"amount\":12000}"));

        anular(id, " ").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Escribe el motivo de la anulación."));
        anular(id, "Cliente devolvió el producto")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ANULADO"))
            .andExpect(jsonPath("$.voidReason").value("Cliente devolvió el producto"))
            .andExpect(jsonPath("$.voidedAt").isNotEmpty());
        anular(id, "Otra vez").andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(ProductSaleService.ALREADY_VOIDED));

        mvc.perform(delete("/api/v1/product-sales/{id}", id).header("Authorization", admin))
            .andExpect(status().isNoContent());
        em.flush();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM product_sales WHERE id = ?", Integer.class, id)).isZero();
        mvc.perform(delete("/api/v1/product-sales/{id}", id).header("Authorization", admin))
            .andExpect(status().isNotFound());
        anular(UUID.randomUUID().toString(), "x").andExpect(status().isNotFound());
    }

    @Test
    void soloElAdminRegistraVentas() throws Exception {
        String body = "{\"date\":\"2020-05-04\",\"concept\":\"Gel\",\"amount\":1000}";
        for (Role role : new Role[] {Role.BARBERO, Role.CLIENTE}) {
            mvc.perform(post("/api/v1/product-sales").header("Authorization", bearer(crear("Otro", role)))
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/product-sales").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
    }

    // ---------- Efecto en el reporte (criterio 3.30 de la spec F5) ----------

    @Test
    void ventaSubeIngresosYGananciaSinTocarReservaNiTicket() throws Exception {
        cita("2020-05-10", "10:00", 25000, 5000);
        reporte()
            .andExpect(jsonPath("$.summary.income").value(25000))
            .andExpect(jsonPath("$.summary.yourProfit").value(20000));

        venta("{\"date\":\"2020-05-10\",\"time\":\"10:40\",\"concept\":\"Aceite de barba\",\"amount\":15000,"
            + "\"paymentMethod\":\"NEQUI_DAVIPLATA\"}").andExpect(status().isCreated());

        reporte()
            .andExpect(jsonPath("$.summary.income").value(40000))         // +15.000
            .andExpect(jsonPath("$.summary.yourProfit").value(35000))     // +15.000
            .andExpect(jsonPath("$.summary.productSales").value(15000))
            .andExpect(jsonPath("$.summary.businessReserve").value(5000)) // la venta no aparta reserva
            .andExpect(jsonPath("$.summary.averageTicket").value(25000))  // ticket de servicios, sin la venta
            .andExpect(jsonPath("$.summary.servicesCount").value(1))
            .andExpect(jsonPath("$.transactions.rows[0].type").value("VENTA"))
            .andExpect(jsonPath("$.transactions.rows[0].income").value(15000))
            .andExpect(jsonPath("$.transactions.rows[0].paymentMethod").value("NEQUI_DAVIPLATA"));
    }

    @Test
    void ventaAnuladaSeListaPeroNoSuma() throws Exception {
        String id = idDe(venta("{\"date\":\"2020-05-12\",\"concept\":\"Shampoo\",\"amount\":20000}"));
        anular(id, "Error de registro").andExpect(status().isOk());

        reporte()
            .andExpect(jsonPath("$.summary.income").value(0))
            .andExpect(jsonPath("$.summary.productSales").value(0))
            .andExpect(jsonPath("$.transactions.total").value(1))
            .andExpect(jsonPath("$.transactions.rows[0].status").value("ANULADO"));
    }

    @Test
    void csvIncluyeLaVentaYSuTotal() throws Exception {
        venta("{\"date\":\"2020-05-04\",\"concept\":\"Cera\",\"amount\":18000}").andExpect(status().isCreated());

        byte[] body = mvc.perform(get("/api/v1/accounting/report.csv?" + MAYO).header("Authorization", admin))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(body, StandardCharsets.UTF_8))
            .contains("\"  de ellos, ventas de productos\",\"18000\"")
            .contains("\"VENTA\",\"Cera\"");
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

    private ResultActions venta(String body) throws Exception {
        return mvc.perform(post("/api/v1/product-sales").header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions anular(String id, String reason) throws Exception {
        return mvc.perform(post("/api/v1/product-sales/{id}/void", id).header("Authorization", admin)
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"%s\"}".formatted(reason)));
    }

    private ResultActions reporte() throws Exception {
        return mvc.perform(get("/api/v1/accounting/report?" + MAYO).header("Authorization", admin));
    }

    private void cita(String date, String time, int gross, int reserve) {
        jdbc.update("""
            INSERT INTO appointments (id, client_id, service_id, date, time, end_time, status, payment_status, payment_method,
                                      gross_amount, reserve_amount)
            VALUES (?, ?, ?, ?, ?, '23:59:00', 'COMPLETADA', 'PAGADO', 'EFECTIVO', ?, ?)""",
            UUID.randomUUID().toString(), cliente.getId(), corte.getId(), date, time, gross, reserve);
    }

    private static String idDe(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getContentAsString().replaceAll("^\\{\"id\":\"([^\"]+)\".*", "$1");
    }
}
