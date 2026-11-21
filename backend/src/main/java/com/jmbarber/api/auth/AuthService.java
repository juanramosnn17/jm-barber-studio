package com.jmbarber.api.auth;

import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.auth.AuthDtos.AuthResponse;
import com.jmbarber.api.auth.AuthDtos.LoginRequest;
import com.jmbarber.api.auth.AuthDtos.RegisterRequest;
import com.jmbarber.api.common.ApiException;
import com.jmbarber.api.users.User;
import com.jmbarber.api.users.UserDto;
import com.jmbarber.api.users.UserRepository;

/** Reglas de registro e inicio de sesión (spec F1, tarea 4.3). */
@Service
public class AuthService {

    static final String BAD_CREDENTIALS =
        "Credenciales incorrectas. Verifica tu correo y contraseña o regístrate si aún no tienes cuenta.";

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final TokenService tokens;

    public AuthService(UserRepository users, PasswordEncoder passwords, TokenService tokens) {
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (!req.password().equals(req.confirmPassword())) {
            throw ApiException.badRequest("Las contraseñas no coinciden.");
        }
        String email = normalizeEmail(req.email());
        if (users.existsByEmail(email)) {
            throw ApiException.conflict("EMAIL_TAKEN", "Ya existe una cuenta con ese correo. Inicia sesión.");
        }
        String phone = req.phone() == null || req.phone().isBlank() ? null : req.phone().trim();
        // El rol de un registro nuevo siempre es CLIENTE (decisión de seguridad del paso 1)
        User user = User.newClient(req.firstName().trim(),
            req.lastName() == null ? "" : req.lastName().trim(), email, phone,
            passwords.encode(req.password()));
        users.save(user);
        return new AuthResponse(tokens.issue(user), UserDto.from(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User user = users.findByEmail(normalizeEmail(req.email()))
            .filter(u -> passwords.matches(req.password(), u.getPasswordHash()))
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", BAD_CREDENTIALS));
        return new AuthResponse(tokens.issue(user), UserDto.from(user));
    }

    /** Usuario de la sesión, leído de la base (rol actual, aunque haya cambiado tras emitir el token). */
    @Transactional(readOnly = true)
    public UserDto me(String userId) {
        return users.findById(userId)
            .map(UserDto::from)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED",
                "Tu sesión ya no es válida. Inicia sesión de nuevo."));
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
