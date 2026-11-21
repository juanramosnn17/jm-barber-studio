package com.jmbarber.api.services;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Cuerpos de /services (docs/contratos/api-rest.md §2). */
public final class ServiceDtos {

    private ServiceDtos() {
    }

    /** Servicio tal como lo recibe el frontend. Precios y reserva en COP enteros. */
    public record ServiceResponse(String id, String name, String shortName, String description, String includes,
                                  long price, String durationLabel, int durationMinutes, String imageUrl,
                                  String icon, boolean isActive, int sortOrder, long reserveAmount) {

        public static ServiceResponse from(BarberService s) {
            return new ServiceResponse(s.getId(), s.getName(), s.getShortName(), s.getDescription(),
                s.getIncludes(), s.getPrice().longValue(), s.getDurationLabel(), s.getDurationMinutes(),
                s.getImageUrl(), s.getIcon(), s.isActive(), s.getSortOrder(), s.getReserveAmount().longValue());
        }
    }

    public record CreateServiceRequest(
        @NotBlank(message = "Nombre y precio son obligatorios.") @Size(max = 120) String name,
        @Size(max = 60) String shortName,
        @Size(max = 2000) String description,
        @Size(max = 255) String includes,
        @NotNull(message = "Nombre y precio son obligatorios.")
        @DecimalMin(value = "1", message = "El precio debe ser mayor a cero.") BigDecimal price,
        @Size(max = 30) String durationLabel,
        @Min(value = 5, message = "La duración debe ser de al menos 5 minutos.")
        @Max(value = 480, message = "La duración no puede superar 8 horas.") Integer durationMinutes,
        @Size(max = 60) String icon,
        @Size(max = 255) String imageUrl,
        @DecimalMin(value = "0", message = "La reserva debe ser un monto igual o mayor a cero.") BigDecimal reserveAmount
    ) {
    }

    /** PUT /services/{id}: mismos campos que crear más la reserva; reemplaza el servicio completo. */
    public record UpdateServiceRequest(
        @NotBlank(message = "Nombre y precio son obligatorios.") @Size(max = 120) String name,
        @Size(max = 60) String shortName,
        @Size(max = 2000) String description,
        @Size(max = 255) String includes,
        @NotNull(message = "Nombre y precio son obligatorios.")
        @DecimalMin(value = "1", message = "El precio debe ser mayor a cero.") BigDecimal price,
        @Size(max = 30) String durationLabel,
        @Min(value = 5, message = "La duración debe ser de al menos 5 minutos.")
        @Max(value = 480, message = "La duración no puede superar 8 horas.") Integer durationMinutes,
        @Size(max = 60) String icon,
        @Size(max = 255) String imageUrl,
        @DecimalMin(value = "0", message = "La reserva debe ser un monto igual o mayor a cero.") BigDecimal reserveAmount
    ) {
    }

    public record ReserveRequest(
        @NotNull(message = "Indica el monto de la reserva.")
        @DecimalMin(value = "0", message = "La reserva debe ser un monto igual o mayor a cero.") BigDecimal reserveAmount
    ) {
    }
}
