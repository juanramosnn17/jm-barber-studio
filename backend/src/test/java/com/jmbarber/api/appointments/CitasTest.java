package com.jmbarber.api.appointments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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

/** Criterios de la tarea 4.5 (specs F2 y F3) contra la base de pruebas. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CitasTest {

    @Autowired private MockMvc mvc;
    @Autowired private TokenService tokens;
    @Autowired private UserRepository users;
    @Autowired private BarberServiceRepository services;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;

    /** Un lunes futuro: la semilla abre de lunes a sábado, 09:00–20:00, descanso 14:00–15:00, turnos de 30 min. */
    private final LocalDate monday = LocalDate.now(TimeConfig.STUDIO_ZONE).plusDays(7)
        .with(TemporalAdjusters.next(DayOfWeek.MONDAY));

    private String cliente;
    private String otroCliente;
    private String barbero;
    private String admin;
    private BarberService corte;

    @BeforeEach
    void datos() {
        cliente = token("Ana", "Cliente", Role.CLIENTE);
        otroCliente = token("Luis", "Otro", Role.CLIENTE);
        barbero = token("Juan", "Barbero", Role.BARBERO);
        admin = token("Admin", "JM", Role.ADMIN);
        corte = services.findByActiveTrueOrderBySortOrderAsc().get(0); // Corte de cabello, 25.000
    }

    // ---------- Reservar ----------

    @Test
    void clienteReservaUnTurnoLibreYQuedaConfirmada() throws Exception {
        reservar(cliente, monday, "10:00")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("CONFIRMADA"))
            .andExpect(jsonPath("$.clientName").value("Ana Cliente"))
            .andExpect(jsonPath("$.serviceName").value("Corte de cabello"))
            .andExpect(jsonPath("$.time").value("10:00"))
            .andExpect(jsonPath("$.date").value(monday.toString()));
    }

    @Test
    void turnoOcupadoResponde409YCanceladoVuelveAQuedarLibre() throws Exception {
        String id = idDe(reservar(cliente, monday, "11:00").andExpect(status().isCreated()));
        reservar(otroCliente, monday, "11:00")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("SLOT_TAKEN"))
            .andExpect(jsonPath("$.message").value(AppointmentService.SLOT_TAKEN));

        estado(cliente, id, "CANCELADA").andExpect(status().isOk());
        reservar(otroCliente, monday, "11:00").andExpect(status().isCreated());
    }

    @Test
    void noSeReservaEnElPasadoNiFueraDelHorario() throws Exception {
        reservar(cliente, LocalDate.now(TimeConfig.STUDIO_ZONE).minusDays(1), "10:00")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(AppointmentService.PAST_SLOT));

        for (String hora : new String[] {"08:30", "20:00", "14:30", "10:15"}) { // antes, cierre, descanso, desalineada
            reservar(cliente, monday, hora)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(AppointmentService.OUTSIDE_HOURS));
        }
        reservar(cliente, monday.minusDays(1), "10:00") // domingo: cerrado
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(AppointmentService.OUTSIDE_HOURS));
    }

    @Test
    void servicioInexistenteOInactivoYDatosIncompletos() throws Exception {
        mvc.perform(post("/api/v1/appointments").header("Authorization", cliente).contentType(MediaType.APPLICATION_JSON)
                .content("{\"serviceId\":\"%s\",\"date\":\"%s\",\"time\":\"10:00\"}".formatted(UUID.randomUUID(), monday)))
            .andExpect(status().isNotFound());

        corte.toggleActive();
        reservar(cliente, monday, "10:00")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(AppointmentService.SERVICE_INACTIVE));

        mvc.perform(post("/api/v1/appointments").header("Authorization", cliente).contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"%s\"}".formatted(monday)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void sinSesionNoSeReservaNiSeVenLasHorasOcupadas() throws Exception {
        mvc.perform(post("/api/v1/appointments").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/appointments/booked-slots").param("date", monday.toString()))
            .andExpect(status().isUnauthorized());
    }

    // ---------- Horas ocupadas y próxima cita ----------

    @Test
    void horasOcupadasSoloTraenHorasSinDatosPersonales() throws Exception {
        reservar(cliente, monday, "16:00").andExpect(status().isCreated());
        reservar(otroCliente, monday, "09:30").andExpect(status().isCreated());

        mvc.perform(get("/api/v1/appointments/booked-slots").param("date", monday.toString())
                .header("Authorization", otroCliente))
            .andExpect(status().isOk())
            .andExpect(content().json("[\"09:30\",\"16:00\"]", true));

        mvc.perform(get("/api/v1/appointments/booked-slots").param("date", "mañana")
                .header("Authorization", cliente))
            .andExpect(status().isBadRequest());
    }

    @Test
    void proximaCitaEsLaMasCercanaDelPropioUsuarioO204() throws Exception {
        mvc.perform(get("/api/v1/appointments/next").header("Authorization", cliente))
            .andExpect(status().isNoContent());

        reservar(cliente, monday.plusDays(1), "09:00").andExpect(status().isCreated());
        reservar(cliente, monday, "18:00").andExpect(status().isCreated());
        reservar(otroCliente, monday, "09:00").andExpect(status().isCreated());

        mvc.perform(get("/api/v1/appointments/next").header("Authorization", cliente))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.date").value(monday.toString()))
            .andExpect(jsonPath("$.time").value("18:00"));
    }

    // ---------- Agenda del día ----------

    @Test
    void agendaDelDiaParaPersonalOrdenadaYSinCanceladas() throws Exception {
        reservar(cliente, monday, "17:00").andExpect(status().isCreated());
        reservar(otroCliente, monday, "09:00").andExpect(status().isCreated());
        String cancelada = idDe(reservar(cliente, monday, "12:00").andExpect(status().isCreated()));
        estado(cliente, cancelada, "CANCELADA").andExpect(status().isOk());

        mvc.perform(get("/api/v1/appointments").param("date", monday.toString()).header("Authorization", barbero))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[*].time", contains("09:00", "17:00")))
            .andExpect(jsonPath("$[0].clientName").value("Luis Otro"))
            .andExpect(jsonPath("$[0].email").doesNotExist())
            .andExpect(jsonPath("$[0].phone").doesNotExist());

        mvc.perform(get("/api/v1/appointments").param("date", monday.toString()).header("Authorization", admin))
            .andExpect(status().isOk());
        mvc.perform(get("/api/v1/appointments").param("date", monday.toString()).header("Authorization", cliente))
            .andExpect(status().isForbidden());
    }

    // ---------- Cambios de estado ----------

    @Test
    void clienteSoloCancelaLasSuyasYSoloSiSiguenActivas() throws Exception {
        String id = idDe(reservar(cliente, monday, "10:30").andExpect(status().isCreated()));

        estado(otroCliente, id, "CANCELADA").andExpect(status().isForbidden());
        estado(cliente, id, "COMPLETADA").andExpect(status().isForbidden());
        estado(cliente, id, "CANCELADA")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELADA"))
            .andExpect(jsonPath("$.paymentStatus").value("ANULADO"));

        String completada = idDe(reservar(cliente, monday, "13:00").andExpect(status().isCreated()));
        estado(barbero, completada, "COMPLETADA").andExpect(status().isOk());
        estado(cliente, completada, "CANCELADA")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(AppointmentService.CANNOT_CANCEL));

        estado(admin, UUID.randomUUID().toString(), "CONFIRMADA").andExpect(status().isNotFound());
    }

    @Test
    void alCompletarSeFijanPagoEnEfectivoYLaReservaDelServicio() throws Exception {
        corte.setReserveAmount(new BigDecimal("5000"));
        String id = idDe(reservar(cliente, monday, "15:00").andExpect(status().isCreated()));

        estado(barbero, id, "EN_CURSO").andExpect(status().isOk());
        estado(barbero, id, "COMPLETADA")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paymentStatus").value("PAGADO"))
            .andExpect(jsonPath("$.paymentMethod").value("EFECTIVO"));

        corte.setReserveAmount(new BigDecimal("9000")); // cambiar la reserva después no altera la cita ya cobrada
        em.flush();
        assertThat(jdbc.queryForObject("SELECT reserve_amount FROM appointments WHERE id = ?", BigDecimal.class, id))
            .isEqualByComparingTo("5000");
        assertThat(jdbc.queryForObject("SELECT gross_amount FROM appointments WHERE id = ?", BigDecimal.class, id))
            .isEqualByComparingTo("25000");

        // Si se corrige el estado, se quita el cobro
        estado(admin, id, "EN_CURSO")
            .andExpect(jsonPath("$.paymentStatus").value("PENDIENTE"))
            .andExpect(jsonPath("$.paymentMethod").doesNotExist());
        em.flush();
        assertThat(jdbc.queryForObject("SELECT reserve_amount FROM appointments WHERE id = ?", BigDecimal.class, id))
            .isNull();
    }

    @Test
    void reactivarUnaCitaCanceladaEnUnTurnoYaTomadoResponde409() throws Exception {
        String id = idDe(reservar(cliente, monday, "19:00").andExpect(status().isCreated()));
        estado(cliente, id, "CANCELADA").andExpect(status().isOk());
        reservar(otroCliente, monday, "19:00").andExpect(status().isCreated());

        estado(admin, id, "CONFIRMADA")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("SLOT_TAKEN"));
    }

    // ---------- Ayudas ----------

    private String token(String firstName, String lastName, Role role) {
        String email = role.name().toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        User user = User.newClient(firstName, lastName, email, "3000000000", "$2a$10$sin-uso-en-esta-prueba");
        user.setRole(role);
        return "Bearer " + tokens.issue(users.save(user));
    }

    private ResultActions reservar(String auth, LocalDate date, String time) throws Exception {
        return mvc.perform(post("/api/v1/appointments").header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"serviceId\":\"%s\",\"date\":\"%s\",\"time\":\"%s\",\"notes\":\"Prueba\"}"
                .formatted(corte.getId(), date, time)));
    }

    private ResultActions estado(String auth, String id, String newStatus) throws Exception {
        return mvc.perform(patch("/api/v1/appointments/{id}/status", id).header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"%s\"}".formatted(newStatus)));
    }

    private static String idDe(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getContentAsString().replaceAll("^\\{\"id\":\"([^\"]+)\".*", "$1");
    }
}
