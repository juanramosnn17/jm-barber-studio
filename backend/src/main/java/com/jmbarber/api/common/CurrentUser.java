package com.jmbarber.api.common;

import java.util.Arrays;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.jmbarber.api.users.Role;

/** Rol de quien hace la petición, tal como lo cargó SecurityConfig desde la base (no el del token). */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Role role() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return null;
        }
        // Un visitante sin sesión trae ROLE_ANONYMOUS: solo cuentan los roles de la app
        return auth.getAuthorities().stream()
            .map(a -> a.getAuthority())
            .flatMap(a -> Arrays.stream(Role.values()).filter(r -> a.equals("ROLE_" + r.name())))
            .findFirst()
            .orElse(null);
    }
}
