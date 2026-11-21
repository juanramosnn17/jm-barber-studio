package com.jmbarber.api.common;

import org.springframework.http.HttpStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

/**
 * Seguridad base de la API REST (tarea 4.1).
 * - Sin sesión de servidor (cada petición traerá su JWT desde la tarea 4.3).
 * - Sin formulario de login ni autenticación básica: es una API, no un sitio web.
 * - Solo /api/v1/health es público por ahora; todo lo demás exige autenticación.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // API sin cookies de sesión: el token JWT viaja en el encabezado (no aplica CSRF)
            .csrf(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Sin token válido → 401 (contrato); por defecto Spring Security respondería 403
            .exceptionHandling(e -> e.authenticationEntryPoint(
                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/health").permitAll()
                .anyRequest().authenticated());
        return http.build();
    }
}
