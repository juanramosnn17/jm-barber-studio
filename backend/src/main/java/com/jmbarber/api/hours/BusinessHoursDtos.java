package com.jmbarber.api.hours;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/** Cuerpos de /business-hours (docs/contratos/api-rest.md §3). Horas en formato "HH:mm". */
public final class BusinessHoursDtos {

    static final String TIME_PATTERN = "^([01]\\d|2[0-3]):[0-5]\\d$";
    static final String TIME_MESSAGE = "Las horas deben tener el formato HH:mm.";
    static final String DAY_MESSAGE = "Los días van de 0 (domingo) a 6 (sábado).";
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private BusinessHoursDtos() {
    }

    public record BusinessHoursResponse(List<Integer> openDays, String openTime, String closeTime,
                                        String breakStart, String breakEnd, int slotMinutes) {

        public static BusinessHoursResponse from(BusinessHours h) {
            return new BusinessHoursResponse(h.getOpenDays(), format(h.getOpenTime()), format(h.getCloseTime()),
                format(h.getBreakStart()), format(h.getBreakEnd()), h.getSlotMinutes());
        }
    }

    public record BusinessHoursRequest(
        @NotEmpty(message = "Selecciona al menos un día de atención.")
        List<@NotNull(message = DAY_MESSAGE) @Min(value = 0, message = DAY_MESSAGE)
             @Max(value = 6, message = DAY_MESSAGE) Integer> openDays,
        @NotNull(message = "Indica la hora de apertura.") @Pattern(regexp = TIME_PATTERN, message = TIME_MESSAGE)
        String openTime,
        @NotNull(message = "Indica la hora de cierre.") @Pattern(regexp = TIME_PATTERN, message = TIME_MESSAGE)
        String closeTime,
        @Pattern(regexp = TIME_PATTERN, message = TIME_MESSAGE) String breakStart,
        @Pattern(regexp = TIME_PATTERN, message = TIME_MESSAGE) String breakEnd,
        @NotNull(message = "Indica la duración de cada turno.")
        @Min(value = 10, message = "Cada turno debe durar al menos 10 minutos.")
        @Max(value = 240, message = "Cada turno no puede durar más de 4 horas.") Integer slotMinutes
    ) {
    }

    static String format(LocalTime time) {
        return time == null ? null : time.format(HH_MM);
    }

    static LocalTime parse(String time) {
        return time == null || time.isBlank() ? null : LocalTime.parse(time, HH_MM);
    }
}
