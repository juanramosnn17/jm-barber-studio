package com.jmbarber.api.services;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.common.ApiException;
import com.jmbarber.api.services.ServiceDtos.CreateServiceRequest;
import com.jmbarber.api.services.ServiceDtos.ServiceResponse;
import com.jmbarber.api.services.ServiceDtos.UpdateServiceRequest;

/** Reglas del catálogo (spec F4 y tarea 3.27). */
@Service
public class BarberServiceService {

    static final String NOT_FOUND = "El servicio no existe.";
    static final String RESERVE_TOO_HIGH = "La reserva no puede superar el precio del servicio.";

    private final BarberServiceRepository repository;

    public BarberServiceService(BarberServiceRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ServiceResponse> list(boolean includeInactive) {
        List<BarberService> services = includeInactive
            ? repository.findAllByOrderBySortOrderAsc()
            : repository.findByActiveTrueOrderBySortOrderAsc();
        return services.stream().map(ServiceResponse::from).toList();
    }

    @Transactional
    public ServiceResponse create(CreateServiceRequest req) {
        String name = req.name().trim();
        BarberService service = BarberService.create(
            name,
            orDefault(req.shortName(), name),
            orDefault(req.description(), name),
            blankToNull(req.includes()),
            req.price(),
            orDefault(req.durationLabel(), (req.durationMinutes() == null ? 30 : req.durationMinutes()) + " min"),
            req.durationMinutes() == null ? 30 : req.durationMinutes(),
            orDefault(req.icon(), "content_cut"),
            blankToNull(req.imageUrl()),
            repository.maxSortOrder() + 1);
        return ServiceResponse.from(repository.save(service));
    }

    @Transactional
    public ServiceResponse update(String id, UpdateServiceRequest req) {
        BarberService service = find(id);
        BigDecimal reserve = req.reserveAmount() == null ? BigDecimal.ZERO : req.reserveAmount();
        if (reserve.compareTo(req.price()) > 0) {
            throw ApiException.badRequest(RESERVE_TOO_HIGH);
        }
        String name = req.name().trim();
        int minutes = req.durationMinutes() == null ? 30 : req.durationMinutes();
        service.update(name, orDefault(req.shortName(), name), orDefault(req.description(), name),
            blankToNull(req.includes()), req.price(), orDefault(req.durationLabel(), minutes + " min"), minutes,
            orDefault(req.icon(), "content_cut"), blankToNull(req.imageUrl()), reserve);
        return ServiceResponse.from(service);
    }

    @Transactional
    public ServiceResponse toggleActive(String id) {
        BarberService service = find(id);
        service.toggleActive();
        return ServiceResponse.from(service);
    }

    @Transactional
    public ServiceResponse updateReserve(String id, BigDecimal reserveAmount) {
        BarberService service = find(id);
        if (reserveAmount.compareTo(service.getPrice()) > 0) {
            throw ApiException.badRequest(RESERVE_TOO_HIGH);
        }
        service.setReserveAmount(reserveAmount);
        return ServiceResponse.from(service);
    }

    private BarberService find(String id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    private static String orDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
