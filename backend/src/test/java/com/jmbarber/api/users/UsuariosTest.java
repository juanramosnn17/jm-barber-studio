package com.jmbarber.api.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.auth.TokenService;
import com.jmbarber.api.services.BarberServiceRepository;

/** Criterios de la tarea 4.6 (spec F4: usuarios y roles) contra la base de pruebas. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UsuariosTest {

    @Autowired private MockMvc mvc;
    @Autowired private TokenService tokens;
    @Autowired private UserRepository users;
    @Autowired private BarberServiceRepository services;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;

    private User admin;
    private String adminToken;
    private User cliente;
    private String clienteToken;

    @BeforeEach
    void datos() {
        admin = crear("Zoe", "Admin", Role.ADMIN);
        adminToken = bearer(admin);
        cliente = crear("Ana", "Cliente", Role.CLIENTE);
        clienteToken = bearer(cliente);
    }

    // ---------- Listado ----------

    @Test
    void adminVeElListadoPaginadoConAdminsPrimeroYSinContrasenas() throws Exception {
        crear("Bruno", "Barbero", Role.BARBERO);
        mvc.perform(get("/api/v1/users").param("page", "1").param("size", "2").header("Authorization", adminToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rows", hasSize(2)))
            .andExpect(jsonPath("$.rows[0].role").value("ADMIN"))
            .andExpect(jsonPath("$.rows[1].role").value("BARBERO"))
            .andExpect(jsonPath("$.rows[0].passwordHash").doesNotExist())
            .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(3)));

        mvc.perform(get("/api/v1/users").param("page", "2").param("size", "2").header("Authorization", adminToken))
            .andExpect(jsonPath("$.rows[0].role").value("CLIENTE"));
    }

    @Test
    void clienteYBarberoNoAdministranUsuarios() throws Exception {
        String barbero = bearer(crear("Bruno", "Barbero", Role.BARBERO));
        for (String token : new String[] {clienteToken, barbero}) {
            mvc.perform(get("/api/v1/users").header("Authorization", token)).andExpect(status().isForbidden());
            editar(token, cliente.getId(), "Ana", "ana@example.com", "ADMIN").andExpect(status().isForbidden());
            mvc.perform(delete("/api/v1/users/{id}", admin.getId()).header("Authorization", token))
                .andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/v1/users")).andExpect(status().isUnauthorized());
    }

    // ---------- Editar ----------

    @Test
    void adminEditaDatosYRolYElCambioAplicaDeInmediato() throws Exception {
        editar(adminToken, cliente.getId(), "  Ana María ", "ANA.NUEVA@Example.com", "BARBERO")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.firstName").value("Ana María"))
            .andExpect(jsonPath("$.email").value("ana.nueva@example.com"))
            .andExpect(jsonPath("$.role").value("BARBERO"));

        // El token del cliente es anterior al cambio, pero la API lee el rol actual: ya ve la agenda
        mvc.perform(get("/api/v1/appointments").param("date", LocalDate.now().toString())
                .header("Authorization", clienteToken))
            .andExpect(status().isOk());
    }

    @Test
    void adminQueEsDegradadoPierdeElAccesoAunqueSuTokenSigaVigente() throws Exception {
        User otroAdmin = crear("Otro", "Admin", Role.ADMIN);
        editar(bearer(otroAdmin), admin.getId(), "Zoe", admin.getEmail(), "CLIENTE").andExpect(status().isOk());

        mvc.perform(get("/api/v1/users").header("Authorization", adminToken)).andExpect(status().isForbidden());
    }

    @Test
    void erroresAlEditar() throws Exception {
        editar(adminToken, admin.getId(), "Zoe", admin.getEmail(), "BARBERO")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(UserAdminService.SELF_DEMOTE));
        editar(adminToken, cliente.getId(), "Ana", admin.getEmail().toUpperCase(), "CLIENTE")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
        editar(adminToken, cliente.getId(), "", "ana@example.com", "CLIENTE")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Nombre y correo son obligatorios."));
        editar(adminToken, cliente.getId(), "Ana", "no-es-correo", "CLIENTE").andExpect(status().isBadRequest());
        editar(adminToken, cliente.getId(), "Ana", "ana@example.com", "SUPERADMIN").andExpect(status().isBadRequest());
        editar(adminToken, UUID.randomUUID().toString(), "Ana", "x@example.com", "CLIENTE")
            .andExpect(status().isNotFound());
    }

    // ---------- Eliminar ----------

    @Test
    void eliminarBorraAlUsuarioSusCitasYSuTokenDejaDeServir() throws Exception {
        em.flush();
        String serviceId = services.findByActiveTrueOrderBySortOrderAsc().get(0).getId();
        jdbc.update("INSERT INTO appointments (id, client_id, service_id, date, time, status) VALUES (?, ?, ?, ?, '10:00', 'CONFIRMADA')",
            UUID.randomUUID().toString(), cliente.getId(), serviceId, LocalDate.now().plusDays(30));

        mvc.perform(delete("/api/v1/users/{id}", cliente.getId()).header("Authorization", adminToken))
            .andExpect(status().isNoContent());
        em.flush();

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Integer.class, cliente.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM appointments WHERE client_id = ?", Integer.class, cliente.getId()))
            .isZero();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", clienteToken))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void adminNoSeEliminaASiMismoY404SiNoExiste() throws Exception {
        mvc.perform(delete("/api/v1/users/{id}", admin.getId()).header("Authorization", adminToken))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(UserAdminService.SELF_DELETE));
        mvc.perform(delete("/api/v1/users/{id}", UUID.randomUUID().toString()).header("Authorization", adminToken))
            .andExpect(status().isNotFound());
    }

    // ---------- Ayudas ----------

    private User crear(String firstName, String lastName, Role role) {
        String email = firstName.toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        User user = User.newClient(firstName, lastName, email, null, "$2a$10$sin-uso-en-esta-prueba");
        user.setRole(role);
        return users.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + tokens.issue(user);
    }

    private ResultActions editar(String auth, String id, String firstName, String email, String role) throws Exception {
        return mvc.perform(put("/api/v1/users/{id}", id).header("Authorization", auth)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"firstName":"%s","lastName":"Prueba","email":"%s","phone":"3001234567","role":"%s"}"""
                .formatted(firstName, email, role)));
    }
}
