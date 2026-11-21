package com.jmbarber.api.common;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import com.jmbarber.api.users.User;
import com.jmbarber.api.users.UserRepository;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

import jakarta.servlet.http.HttpServletResponse;

/**
 * Seguridad de la API REST (tareas 4.1 y 4.3).
 * - Sin sesión de servidor: cada petición trae su JWT en "Authorization: Bearer".
 * - El rol actual del usuario (leído de la base en cada petición) se convierte en
 *   ROLE_CLIENTE / ROLE_BARBERO / ROLE_ADMIN, que usan las reglas @PreAuthorize (equivalen a RLS).
 * - Rutas públicas: health, registro, inicio de sesión y el catálogo/horario de solo lectura.
 * - Sin token → 401; con token pero sin el rol → 403. Siempre { status, code, message }.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final UserRepository users;

    public SecurityConfig(UserRepository users) {
        this.users = users;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // API sin cookies de sesión: el token viaja en el encabezado (no aplica CSRF)
            .csrf(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/health", "/error").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/services", "/api/v1/business-hours").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(rs -> rs
                .jwt(jwt -> jwt.jwtAuthenticationConverter(roleConverter()))
                .authenticationEntryPoint(unauthorized()))
            .exceptionHandling(e -> e
                .authenticationEntryPoint(unauthorized())
                .accessDeniedHandler(forbidden()));
        return http.build();
    }

    /**
     * Convierte el token en autoridad ROLE_X con el rol ACTUAL de la base (tarea 4.6): un cambio de
     * rol aplica de inmediato y el token de una cuenta eliminada deja de servir (401).
     */
    private Converter<Jwt, AbstractAuthenticationToken> roleConverter() {
        return jwt -> {
            User user = users.findById(jwt.getSubject())
                .orElseThrow(() -> new InvalidBearerTokenException("La cuenta del token ya no existe."));
            return new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())), jwt.getSubject());
        };
    }

    private AuthenticationEntryPoint unauthorized() {
        return (request, response, ex) -> write(response, new ApiError(
            HttpStatus.UNAUTHORIZED.value(), "UNAUTHORIZED", ApiError.UNAUTHORIZED_MESSAGE));
    }

    private AccessDeniedHandler forbidden() {
        return (request, response, ex) -> write(response, new ApiError(
            HttpStatus.FORBIDDEN.value(), "FORBIDDEN", ApiError.FORBIDDEN_MESSAGE));
    }

    private static void write(HttpServletResponse response, ApiError error) throws java.io.IOException {
        response.setStatus(error.status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(error.toJson());
    }
}
