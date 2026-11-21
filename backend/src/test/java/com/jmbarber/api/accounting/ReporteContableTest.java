package com.jmbarber.api.accounting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
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

/**
 * Criterios de la tarea 4.8 y del modelo de reserva de la spec F5 (3.27 y 3.29).
 * Las citas cobradas se insertan directo en marzo de 2020 (la API no deja reservar en el pasado).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ReporteContableTest {

    private static final String MARZO = "period=custom&startDate=2020-03-01&endDate=2020-03-31";

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

    // ---------- Modelo de reserva ----------

    @Test
    void citaCobradaSumaIngresoReservaYGananciaSinComision() throws Exception {
        cita("2020-03-10", "10:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, 5000);
        corte.setReserveAmount(new BigDecimal("6000")); // 3.27 Historial: cambiarla después no altera la cita
        em.flush();

        reporte(MARZO)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.period.startDate").value("2020-03-01"))
            .andExpect(jsonPath("$.summary.income").value(25000))
            .andExpect(jsonPath("$.summary.businessReserve").value(5000))
            .andExpect(jsonPath("$.summary.yourProfit").value(20000))
            .andExpect(jsonPath("$.summary.servicesCount").value(1))
            .andExpect(jsonPath("$.summary.averageTicket").value(25000));
    }

    @Test
    void saldoDeLaReservaNegativoCuandoLosGastosLaSuperan() throws Exception {
        cita("2020-03-10", "10:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, 5000);
        cita("2020-03-11", "10:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, 5000);
        gasto("2020-03-12", "Arriendo", 12000, "REGISTRADO");

        reporte(MARZO)
            .andExpect(jsonPath("$.summary.businessReserve").value(10000))
            .andExpect(jsonPath("$.summary.expenses").value(12000))
            .andExpect(jsonPath("$.summary.reserveBalance").value(-2000));
    }

    @Test
    void soloCuentanCitasCobradasYGastosRegistrados() throws Exception {
        cita("2020-03-05", "09:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, 5000);
        cita("2020-03-05", "10:00", "CONFIRMADA", "PENDIENTE", null, 0, 0, 0, null);
        cita("2020-03-05", "11:00", "CANCELADA", "ANULADO", null, 0, 0, 0, null);
        cita("2020-03-05", "12:00", "COMPLETADA", "ANULADO", 25000, 0, 0, 0, 5000);
        cita("2020-04-01", "09:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, 5000); // fuera del periodo
        gasto("2020-03-06", "Luz", 30000, "REGISTRADO");
        gasto("2020-03-07", "Duplicado", 99000, "ANULADO");

        reporte(MARZO)
            .andExpect(jsonPath("$.summary.income").value(25000))
            .andExpect(jsonPath("$.summary.expenses").value(30000))
            .andExpect(jsonPath("$.transactions.total").value(3)) // 1 cita cobrada + 2 gastos (el anulado se lista)
            .andExpect(jsonPath("$.transactions.rows[0].concept").value("Duplicado"))
            .andExpect(jsonPath("$.transactions.rows[0].status").value("ANULADO"));
    }

    @Test
    void descuentoReembolsoYPropinasAparte() throws Exception {
        cita("2020-03-10", "10:00", "COMPLETADA", "PAGADO", 25000, 5000, 0, 3000, 5000);
        cita("2020-03-11", "10:00", "COMPLETADA", "REEMBOLSADO", 25000, 0, 25000, 0, 5000); // reembolso total
        cita("2020-03-12", "10:00", "COMPLETADA", "PAGADO", 25000, 22000, 0, 0, 5000); // la reserva no supera el neto

        reporte(MARZO + "&size=1")
            .andExpect(jsonPath("$.transactions.rows[0].discount").value(22000)) // detalle para ajustar el pago
            .andExpect(jsonPath("$.transactions.rows[0].category").doesNotExist());
        reporte(MARZO)
            .andExpect(jsonPath("$.summary.income").value(23000))          // 20.000 + 0 + 3.000
            .andExpect(jsonPath("$.summary.businessReserve").value(8000))  // 5.000 + 0 + min(5.000, 3.000)
            .andExpect(jsonPath("$.summary.yourProfit").value(15000))
            .andExpect(jsonPath("$.summary.servicesCount").value(2))
            .andExpect(jsonPath("$.summary.averageTicket").value(11500))
            .andExpect(jsonPath("$.summary.tips").value(3000));
    }

    @Test
    void sinReservaFijadaUsaLaActualDelServicio() throws Exception {
        corte.setReserveAmount(new BigDecimal("4000"));
        em.flush();
        cita("2020-03-10", "10:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, null);

        reporte(MARZO).andExpect(jsonPath("$.summary.businessReserve").value(4000));
    }

    @Test
    void periodoSinMovimientosTieneTicketNulo() throws Exception {
        reporte("period=custom&startDate=2019-01-01&endDate=2019-01-31")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.income").value(0))
            .andExpect(jsonPath("$.summary.averageTicket").doesNotExist())
            .andExpect(jsonPath("$.transactions.rows", hasSize(0)))
            .andExpect(jsonPath("$.transactions.totalPages").value(1));
    }

    // ---------- Tabla y periodos ----------

    @Test
    void tablaPaginadaOrdenadaDeLoMasRecienteALoMasAntiguo() throws Exception {
        cita("2020-03-02", "09:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, 5000);
        cita("2020-03-02", "15:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 0, 5000);
        gasto("2020-03-20", "Publicidad", 10000, "REGISTRADO");

        reporte(MARZO + "&page=1&size=2")
            .andExpect(jsonPath("$.transactions.total").value(3))
            .andExpect(jsonPath("$.transactions.totalPages").value(2))
            .andExpect(jsonPath("$.transactions.rows[*].time", contains("12:00", "15:00")))
            .andExpect(jsonPath("$.transactions.rows[1].clientName").value("Ana Prueba"))
            .andExpect(jsonPath("$.transactions.rows[1].type").value("INGRESO"));
        reporte(MARZO + "&page=2&size=2")
            .andExpect(jsonPath("$.transactions.rows[0].time").value("09:00"));
    }

    @Test
    void periodosRapidosYErrores() throws Exception {
        LocalDate hoy = LocalDate.now(TimeConfig.STUDIO_ZONE);
        reporte("period=today")
            .andExpect(jsonPath("$.period.startDate").value(hoy.toString()))
            .andExpect(jsonPath("$.period.endDate").value(hoy.toString()));
        reporte("")
            .andExpect(jsonPath("$.period.key").value("this_month"))
            .andExpect(jsonPath("$.period.startDate").value(hoy.withDayOfMonth(1).toString()));

        reporte("period=anual").andExpect(status().isBadRequest());
        reporte("period=custom&startDate=2020-03-01").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(ReportPeriod.CUSTOM_REQUIRED));
        reporte("period=custom&startDate=2020-03-31&endDate=2020-03-01").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(ReportPeriod.CUSTOM_ORDER));
        reporte("period=custom&startDate=2020-01-01&endDate=2021-01-02").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(ReportPeriod.CUSTOM_TOO_LONG));
    }

    @Test
    void periodoDeLaSemanaVaDeLunesADomingo() {
        ReportPeriod p = ReportPeriod.resolve("this_week", null, null, LocalDate.of(2026, 11, 22)); // domingo
        assertThat(p.startDate()).isEqualTo(LocalDate.of(2026, 11, 16));
        assertThat(p.endDate()).isEqualTo(LocalDate.of(2026, 11, 22));
        ReportPeriod last = ReportPeriod.resolve("last_month", null, null, LocalDate.of(2026, 3, 31));
        assertThat(last.startDate()).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(last.endDate()).isEqualTo(LocalDate.of(2026, 2, 28));
    }

    @Test
    void barberoYClienteNoVenLaContabilidad() throws Exception {
        for (String token : new String[] {bearer(crear("Bruno", Role.BARBERO)), bearer(cliente)}) {
            mvc.perform(get("/api/v1/accounting/report").header("Authorization", token))
                .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/accounting/report.csv").header("Authorization", token))
                .andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/v1/accounting/report")).andExpect(status().isUnauthorized());
    }

    // ---------- CSV ----------

    @Test
    void csvDescargableConResumenFilasYCeldasSaneadas() throws Exception {
        cita("2020-03-10", "10:00", "COMPLETADA", "PAGADO", 25000, 0, 0, 2000, 5000);
        gasto("2020-03-12", "=HYPERLINK(\"http://malo\")", 32000, "REGISTRADO");

        byte[] body = mvc.perform(get("/api/v1/accounting/report.csv?" + MARZO).header("Authorization", admin))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition",
                org.hamcrest.Matchers.containsString("reporte-contable_2020-03-01_2020-03-31.csv")))
            .andExpect(header().string("Content-Type", org.hamcrest.Matchers.startsWith("text/csv")))
            .andReturn().getResponse().getContentAsByteArray();

        assertThat(body[0]).isEqualTo((byte) 0xEF); // BOM UTF-8 para Excel
        String csv = new String(body, StandardCharsets.UTF_8);
        assertThat(csv)
            .contains("\"Ingresos\",\"25000\"")
            .contains("\"Saldo de la reserva\",\"-27000\"")   // número negativo legítimo: sin alterar
            .contains("\"Propinas (aparte)\",\"2000\"")
            .contains("\"Método de pago\"")
            .contains("\"'=HYPERLINK(\"\"http://malo\"\")\"") // fórmula neutralizada y comillas escapadas
            .contains("\"Corte de cabello\",\"Ana Prueba\"");
    }

    @Test
    void celdasDeTextoPeligrosasSeNeutralizan() {
        assertThat(CsvExporter.text("+57 300")).isEqualTo("\"'+57 300\"");
        assertThat(CsvExporter.text("-1+1")).isEqualTo("\"'-1+1\"");
        assertThat(CsvExporter.text("@SUM(A1)")).isEqualTo("\"'@SUM(A1)\"");
        assertThat(CsvExporter.text("  =1")).isEqualTo("\"'  =1\"");
        assertThat(CsvExporter.text("Corte")).isEqualTo("\"Corte\"");
        assertThat(CsvExporter.number(-2000)).isEqualTo("\"-2000\"");
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

    private ResultActions reporte(String query) throws Exception {
        return mvc.perform(get("/api/v1/accounting/report?" + query).header("Authorization", admin));
    }

    private void cita(String date, String time, String status, String paymentStatus, Integer gross,
                      int discount, int refund, int tip, Integer reserve) {
        jdbc.update("""
            INSERT INTO appointments (id, client_id, service_id, date, time, end_time, status, payment_status, payment_method,
                                      gross_amount, discount_amount, refund_amount, tip_amount, reserve_amount)
            VALUES (?, ?, ?, ?, ?, '23:59:00', ?, ?, 'EFECTIVO', ?, ?, ?, ?, ?)""",
            UUID.randomUUID().toString(), cliente.getId(), corte.getId(), date, time, status, paymentStatus,
            gross, discount, refund, tip, reserve);
    }

    private void gasto(String date, String concept, int amount, String status) {
        jdbc.update("""
            INSERT INTO expenses (id, date, time, category, concept, amount, payment_method, status)
            VALUES (?, ?, '12:00', 'OTROS', ?, ?, 'EFECTIVO', ?)""",
            UUID.randomUUID().toString(), date, concept, amount, status);
    }
}
