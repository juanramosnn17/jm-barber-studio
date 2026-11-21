package com.jmbarber.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import jakarta.persistence.EntityManager;

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

/** Criterios de la tarea 4.3 y de la spec F1 contra la base de pruebas. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthControllerTest {

    private static final String PASSWORD = "clave-segura-123";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    /** En una prueba @Transactional, JPA escribe en MySQL al hacer flush; JdbcTemplate consulta MySQL directo. */
    @Autowired
    private EntityManager em;

    @Test
    void registroCreaClienteConContrasenaCifradaYDevuelveToken() throws Exception {
        String email = nuevoCorreo();
        registrar(email, PASSWORD, PASSWORD)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.token").isNotEmpty())
            .andExpect(jsonPath("$.user.role").value("CLIENTE"))
            .andExpect(jsonPath("$.user.email").value(email));

        em.flush();
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
        assertThat(hash).startsWith("$2").isNotEqualTo(PASSWORD); // BCrypt, nunca texto plano
    }

    @Test
    void registroIgnoraElRolEnviadoPorElUsuario() throws Exception {
        String email = nuevoCorreo();
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
                {"firstName":"Intruso","email":"%s","password":"%s","confirmPassword":"%s",
                 "acceptsDataUse":true,"role":"ADMIN"}""".formatted(email, PASSWORD, PASSWORD)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.user.role").value("CLIENTE"));
    }

    @Test
    void registroConContrasenasDistintasResponde400() throws Exception {
        registrar(nuevoCorreo(), PASSWORD, "otra-clave-123")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Las contraseñas no coinciden."));
    }

    @Test
    void registroConCorreoRepetidoResponde409() throws Exception {
        String email = nuevoCorreo();
        registrar(email, PASSWORD, PASSWORD).andExpect(status().isCreated());
        registrar(email.toUpperCase(), PASSWORD, PASSWORD)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void loginCorrectoDevuelveTokenYMeDevuelveElUsuario() throws Exception {
        String email = nuevoCorreo();
        registrar(email, PASSWORD, PASSWORD).andExpect(status().isCreated());

        String token = login(email, PASSWORD);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value(email))
            .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void loginConCredencialesIncorrectasResponde401ConElMensajeDeLaSpec() throws Exception {
        String email = nuevoCorreo();
        registrar(email, PASSWORD, PASSWORD).andExpect(status().isCreated());

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"incorrecta\"}".formatted(email)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value(AuthService.BAD_CREDENTIALS));
    }

    @Test
    void sinTokenOTokenFalsoResponde401() throws Exception {
        mvc.perform(get("/api/v1/auth/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer token.falso.firmado"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void clienteEnEndpointDeAdminResponde403YAdminEntra() throws Exception {
        String email = nuevoCorreo();
        registrar(email, PASSWORD, PASSWORD).andExpect(status().isCreated());

        mvc.perform(get("/api/v1/test/solo-admin").header("Authorization", "Bearer " + login(email, PASSWORD)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("No tienes permisos para realizar esta acción."));

        // Promoción a admin (como hará el script del primer admin) y nuevo inicio de sesión
        em.flush();
        jdbc.update("UPDATE users SET role = 'ADMIN' WHERE email = ?", email);
        em.clear(); // que el siguiente login lea el rol nuevo desde MySQL
        mvc.perform(get("/api/v1/test/solo-admin").header("Authorization", "Bearer " + login(email, PASSWORD)))
            .andExpect(status().isOk());
    }

    private ResultActions registrar(String email, String password, String confirm) throws Exception {
        return mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
            {"firstName":"Juan","lastName":"Prueba","email":"%s","phone":"3001234567",
             "password":"%s","confirmPassword":"%s","acceptsDataUse":true}""".formatted(email, password, confirm)));
    }

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return body.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
    }

    private static String nuevoCorreo() {
        return "prueba-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }
}
