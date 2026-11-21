package com.jmbarber.api.users;

import java.util.List;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Cuerpos de /users (docs/contratos/api-rest.md §5). */
public final class UserAdminDtos {

    static final String REQUIRED = "Nombre y correo son obligatorios.";

    private UserAdminDtos() {
    }

    public record UsersPage(List<UserDto> rows, long total) {
    }

    public record UpdateUserRequest(
        @NotBlank(message = REQUIRED) @Size(max = 80, message = "El nombre no puede superar 80 caracteres.") String firstName,
        @Size(max = 80, message = "El apellido no puede superar 80 caracteres.") String lastName,
        @NotBlank(message = REQUIRED) @Email(message = "Escribe un correo válido.") @Size(max = 160) String email,
        @Size(max = 30, message = "El teléfono no puede superar 30 caracteres.") String phone,
        @NotNull(message = "Selecciona el rol del usuario.") Role role
    ) {
    }
}
