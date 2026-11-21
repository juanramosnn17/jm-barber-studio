package com.jmbarber.api.auth;

import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint que solo existe en las pruebas (src/test), para comprobar que un rol sin
 * permiso recibe 403 antes de que existan los endpoints reales de admin (tareas 4.4+).
 */
@RestController
class AdminOnlyTestController {

    @GetMapping("/api/v1/test/solo-admin")
    @PreAuthorize("hasRole('ADMIN')")
    Map<String, String> soloAdmin() {
        return Map.of("ok", "admin");
    }
}
