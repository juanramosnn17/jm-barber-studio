package com.jmbarber.api.hours;

import java.time.LocalTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.common.ApiException;
import com.jmbarber.api.hours.BusinessHoursDtos.BusinessHoursRequest;
import com.jmbarber.api.hours.BusinessHoursDtos.BusinessHoursResponse;

/** Horario de atención (specs F2 y F4). */
@Service
public class BusinessHoursService {

    static final String CLOSE_BEFORE_OPEN = "La hora de cierre debe ser posterior a la de apertura.";
    static final String BREAK_INCOMPLETE = "Indica el inicio y el fin del descanso, o deja ambos vacíos.";
    static final String BREAK_OUTSIDE =
        "El descanso debe estar dentro del horario de atención y terminar después de empezar.";

    private final BusinessHoursRepository repository;

    public BusinessHoursService(BusinessHoursRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public BusinessHoursResponse get() {
        return BusinessHoursResponse.from(load());
    }

    @Transactional
    public BusinessHoursResponse update(BusinessHoursRequest req) {
        LocalTime open = BusinessHoursDtos.parse(req.openTime());
        LocalTime close = BusinessHoursDtos.parse(req.closeTime());
        LocalTime breakStart = BusinessHoursDtos.parse(req.breakStart());
        LocalTime breakEnd = BusinessHoursDtos.parse(req.breakEnd());

        if (!close.isAfter(open)) {
            throw ApiException.badRequest(CLOSE_BEFORE_OPEN);
        }
        if ((breakStart == null) != (breakEnd == null)) {
            throw ApiException.badRequest(BREAK_INCOMPLETE);
        }
        if (breakStart != null
            && (breakStart.isBefore(open) || breakEnd.isAfter(close) || !breakEnd.isAfter(breakStart))) {
            throw ApiException.badRequest(BREAK_OUTSIDE);
        }

        BusinessHours hours = load();
        hours.update(req.openDays(), open, close, breakStart, breakEnd, req.slotMinutes());
        return BusinessHoursResponse.from(hours);
    }

    private BusinessHours load() {
        return repository.findById(BusinessHours.SINGLE_ROW_ID)
            .orElseThrow(() -> ApiException.notFound("No hay horario de atención configurado."));
    }
}
