package com.jmbarber.api.services;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.auth.TokenService;
import com.jmbarber.api.users.Role;
import com.jmbarber.api.users.User;
import com.jmbarber.api.users.UserRepository;

/** Criterios de la tarea 4.4: catálogo (F1, F4, 3.27) y horario de atención (F2, F4). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CatalogoYHorarioTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private TokenService tokens;

    @Autowired
    private UserRepository users;

    // ---------- Catálogo ----------

    @Test
    void catalogoPublicoMuestraLosSeisServiciosActivosEnOrden() throws Exception {
        mvc.perform(get("/api/v1/services"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(6)))
            .andExpect(jsonPath("$[0].name").value("Corte de cabello"))
            .andExpect(jsonPath("$[0].price").value(25000))
            .andExpect(jsonPath("$[*].isActive", everyItem(org.hamcrest.Matchers.is(true))));
    }

    @Test
    void servicioDesactivadoSoloLoVeElAdmin() throws Exception {
        String admin = token(Role.ADMIN);
        String id = crearServicio(admin, "Mascarilla negra", 15000);

        mvc.perform(patch("/api/v1/services/{id}/active", id).header("Authorization", admin))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.isActive").value(false));

        mvc.perform(get("/api/v1/services"))
            .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.not(hasItem(id))));
        mvc.perform(get("/api/v1/services").header("Authorization", token(Role.CLIENTE)))
            .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.not(hasItem(id))));
        mvc.perform(get("/api/v1/services").header("Authorization", admin))
            .andExpect(jsonPath("$[*].id", hasItem(id)));
        mvc.perform(get("/api/v1/services?onlyActive=true").header("Authorization", admin))
            .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.not(hasItem(id))));
    }

    @Test
    void crearServicioQuedaActivoAlFinalConValoresPorDefecto() throws Exception {
        mvc.perform(post("/api/v1/services").header("Authorization", token(Role.ADMIN))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Afeitado clásico\",\"price\":20000,\"durationMinutes\":30}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.isActive").value(true))
            .andExpect(jsonPath("$.shortName").value("Afeitado clásico"))
            .andExpect(jsonPath("$.durationLabel").value("30 min"))
            .andExpect(jsonPath("$.sortOrder").value(7))
            .andExpect(jsonPath("$.reserveAmount").value(0));
    }

    @Test
    void crearServicioSinNombreOPrecioResponde400() throws Exception {
        mvc.perform(post("/api/v1/services").header("Authorization", token(Role.ADMIN))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\",\"price\":20000}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Nombre y precio son obligatorios."));
        mvc.perform(post("/api/v1/services").header("Authorization", token(Role.ADMIN))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Algo\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void clienteYBarberoNoPuedenModificarElCatalogo() throws Exception {
        String body = "{\"name\":\"Intruso\",\"price\":1000}";
        for (Role role : new Role[] {Role.CLIENTE, Role.BARBERO}) {
            mvc.perform(post("/api/v1/services").header("Authorization", token(role))
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/services").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void reservaDentroDelPrecioSeGuardaYSobreElPrecioResponde400() throws Exception {
        String admin = token(Role.ADMIN);
        String id = crearServicio(admin, "Corte niño", 18000);

        reserva(admin, id, 5000)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reserveAmount").value(5000));
        reserva(admin, id, 18001)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(BarberServiceService.RESERVE_TOO_HIGH));
        reserva(admin, id, -1).andExpect(status().isBadRequest());
        reserva(token(Role.BARBERO), id, 1000).andExpect(status().isForbidden());
        reserva(admin, UUID.randomUUID().toString(), 1000)
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void crearServicioConReservaLaGuardaYRechazaUnaMayorAlPrecio() throws Exception {
        String admin = token(Role.ADMIN);
        mvc.perform(post("/api/v1/services").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Cejas express\",\"price\":12000,\"reserveAmount\":3000}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.reserveAmount").value(3000));
        mvc.perform(post("/api/v1/services").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Cejas caras\",\"price\":12000,\"reserveAmount\":12001}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(BarberServiceService.RESERVE_TOO_HIGH));
    }

    @Test
    void editarServicioReemplazaSusDatosYValidaLaReserva() throws Exception {
        String admin = token(Role.ADMIN);
        String id = crearServicio(admin, "Corte básico", 20000);

        editar(admin, id, "{\"name\":\"Corte clásico\",\"price\":22000,\"durationMinutes\":45,\"reserveAmount\":4000}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Corte clásico"))
            .andExpect(jsonPath("$.price").value(22000))
            .andExpect(jsonPath("$.durationLabel").value("45 min"))
            .andExpect(jsonPath("$.reserveAmount").value(4000))
            .andExpect(jsonPath("$.isActive").value(true));

        editar(admin, id, "{\"name\":\"Corte\",\"price\":3000,\"reserveAmount\":4000}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(BarberServiceService.RESERVE_TOO_HIGH));
        editar(admin, id, "{\"name\":\"\",\"price\":3000}").andExpect(status().isBadRequest());
        editar(token(Role.BARBERO), id, "{\"name\":\"X\",\"price\":3000}").andExpect(status().isForbidden());
        editar(admin, UUID.randomUUID().toString(), "{\"name\":\"X\",\"price\":3000}").andExpect(status().isNotFound());
    }

    private ResultActions editar(String auth, String id, String body) throws Exception {
        return mvc.perform(put("/api/v1/services/{id}", id).header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    // ---------- Horario ----------

    @Test
    void horarioPublicoTraeLosValoresDeLaSemilla() throws Exception {
        mvc.perform(get("/api/v1/business-hours"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.openDays", hasSize(6)))
            .andExpect(jsonPath("$.openTime").value("09:00"))
            .andExpect(jsonPath("$.closeTime").value("20:00"))
            .andExpect(jsonPath("$.breakStart").value("14:00"))
            .andExpect(jsonPath("$.slotMinutes").value(30));
    }

    @Test
    void adminActualizaElHorarioYSinDescansoQuedaNulo() throws Exception {
        horario(token(Role.ADMIN), "[6,1,2,1]", "08:00", "18:00", null, null, 45)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.openDays", hasSize(3)))
            .andExpect(jsonPath("$.openDays[0]").value(1))
            .andExpect(jsonPath("$.breakStart").doesNotExist());

        mvc.perform(get("/api/v1/business-hours"))
            .andExpect(jsonPath("$.openTime").value("08:00"))
            .andExpect(jsonPath("$.slotMinutes").value(45));
    }

    @Test
    void horarioInvalidoResponde400ConMensajeClaro() throws Exception {
        String admin = token(Role.ADMIN);
        horario(admin, "[1]", "18:00", "08:00", null, null, 30)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(BusinessHoursServiceMessages.CLOSE_BEFORE_OPEN));
        horario(admin, "[1]", "08:00", "18:00", "07:00", "09:00", 30)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(BusinessHoursServiceMessages.BREAK_OUTSIDE));
        horario(admin, "[1]", "08:00", "18:00", "12:00", null, 30)
            .andExpect(status().isBadRequest());
        horario(admin, "[7]", "08:00", "18:00", null, null, 30)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Los días van de 0 (domingo) a 6 (sábado)."));
        horario(admin, "[]", "08:00", "18:00", null, null, 30).andExpect(status().isBadRequest());
        horario(admin, "[1]", "8am", "18:00", null, null, 30).andExpect(status().isBadRequest());
    }

    @Test
    void soloElAdminCambiaElHorario() throws Exception {
        horario(token(Role.BARBERO), "[1]", "08:00", "18:00", null, null, 30).andExpect(status().isForbidden());
        horario(token(Role.CLIENTE), "[1]", "08:00", "18:00", null, null, 30).andExpect(status().isForbidden());
    }

    // ---------- Ayudas ----------

    /** Desde la tarea 4.6 el rol se lee de la base en cada petición: el usuario debe existir. */
    private String token(Role role) {
        String email = role.name().toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        User user = User.newClient("Prueba", role.name(), email, null, "x");
        user.setRole(role);
        return "Bearer " + tokens.issue(users.save(user));
    }

    private String crearServicio(String admin, String name, int price) throws Exception {
        String body = mvc.perform(post("/api/v1/services").header("Authorization", admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"%s\",\"price\":%d}".formatted(name, price)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return body.replaceAll("^\\{\"id\":\"([^\"]+)\".*", "$1");
    }

    private ResultActions reserva(String auth, String id, int amount) throws Exception {
        return mvc.perform(patch("/api/v1/services/{id}/reserve", id).header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON).content("{\"reserveAmount\":%d}".formatted(amount)));
    }

    private ResultActions horario(String auth, String days, String open, String close,
                                  String breakStart, String breakEnd, int slot) throws Exception {
        return mvc.perform(put("/api/v1/business-hours").header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"openDays":%s,"openTime":"%s","closeTime":"%s","breakStart":%s,"breakEnd":%s,"slotMinutes":%d}"""
                .formatted(days, open, close, quote(breakStart), quote(breakEnd), slot)));
    }

    private static String quote(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }

    /** Los mensajes del servicio de horario son package-private en otro paquete; se repiten aquí. */
    private static final class BusinessHoursServiceMessages {
        static final String CLOSE_BEFORE_OPEN = "La hora de cierre debe ser posterior a la de apertura.";
        static final String BREAK_OUTSIDE =
            "El descanso debe estar dentro del horario de atención y terminar después de empezar.";
    }
}
