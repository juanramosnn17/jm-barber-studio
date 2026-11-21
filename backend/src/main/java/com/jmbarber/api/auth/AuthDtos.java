package com.jmbarber.api.auth;

import com.jmbarber.api.users.UserDto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cuerpos de petición y respuesta de /auth (docs/contratos/api-rest.md §1). */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
        @NotBlank(message = "Por favor completa todos los campos obligatorios.") String firstName,
        String lastName,
        @NotBlank(message = "Por favor completa todos los campos obligatorios.")
        @Email(message = "Escribe un correo electrónico válido.") String email,
        @Size(max = 30, message = "El teléfono es demasiado largo.") String phone,
        @NotBlank(message = "Por favor completa todos los campos obligatorios.")
        @Size(min = 6, max = 72, message = "La contraseña debe tener entre 6 y 72 caracteres.") String password,
        @NotBlank(message = "Por favor completa todos los campos obligatorios.") String confirmPassword,
        @AssertTrue(message = "Debes autorizar el uso de tus datos para gestionar tus citas.") boolean acceptsDataUse
    ) {
    }

    public record LoginRequest(
        @NotBlank(message = "Por favor ingresa tu correo y tu contraseña.") String email,
        @NotBlank(message = "Por favor ingresa tu correo y tu contraseña.") String password
    ) {
    }

    public record AuthResponse(String token, UserDto user) {
    }
}
