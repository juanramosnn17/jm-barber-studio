package com.jmbarber.api.common;

/** Cuerpo de todas las respuestas de error: { status, code, message } en español. */
public record ApiError(int status, String code, String message) {

    public static final String FORBIDDEN_MESSAGE = "No tienes permisos para realizar esta acción.";
    public static final String UNAUTHORIZED_MESSAGE = "Debes iniciar sesión para continuar.";

    /** JSON escrito a mano para los filtros de seguridad (fuera de Spring MVC). */
    public String toJson() {
        return "{\"status\":" + status + ",\"code\":\"" + code + "\",\"message\":\""
            + message.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}";
    }
}
