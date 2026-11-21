package com.jmbarber.api.services;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.jmbarber.api.services.ServiceDtos.CreateServiceRequest;
import com.jmbarber.api.services.ServiceDtos.ReserveRequest;
import com.jmbarber.api.services.ServiceDtos.ServiceResponse;

/** /api/v1/services (docs/contratos/api-rest.md §2). */
@RestController
@RequestMapping("/api/v1/services")
public class ServicesController {

    private final BarberServiceService service;

    public ServicesController(BarberServiceService service) {
        this.service = service;
    }

    /** Público: solo activos. El admin ve también los inactivos salvo que pida onlyActive=true. */
    @GetMapping
    public List<ServiceResponse> list(@RequestParam(defaultValue = "false") boolean onlyActive) {
        return service.list(!onlyActive && isAdmin());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public ServiceResponse create(@Valid @RequestBody CreateServiceRequest request) {
        return service.create(request);
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasRole('ADMIN')")
    public ServiceResponse toggleActive(@PathVariable String id) {
        return service.toggleActive(id);
    }

    @PatchMapping("/{id}/reserve")
    @PreAuthorize("hasRole('ADMIN')")
    public ServiceResponse updateReserve(@PathVariable String id, @Valid @RequestBody ReserveRequest request) {
        return service.updateReserve(id, request.reserveAmount());
    }

    private static boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
            .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
