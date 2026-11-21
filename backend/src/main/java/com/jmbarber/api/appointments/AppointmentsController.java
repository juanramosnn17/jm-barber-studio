package com.jmbarber.api.appointments;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.jmbarber.api.appointments.AppointmentDtos.AppointmentResponse;
import com.jmbarber.api.appointments.AppointmentDtos.CreateAppointmentRequest;
import com.jmbarber.api.appointments.AppointmentDtos.StatusRequest;
import com.jmbarber.api.common.CurrentUser;

/** /api/v1/appointments (docs/contratos/api-rest.md §4). Todas las rutas exigen sesión. */
@RestController
@RequestMapping("/api/v1/appointments")
public class AppointmentsController {

    private final AppointmentService service;

    public AppointmentsController(AppointmentService service) {
        this.service = service;
    }

    @GetMapping("/booked-slots")
    public List<String> bookedSlots(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.bookedSlots(date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AppointmentResponse create(@AuthenticationPrincipal Jwt jwt,
                                      @Valid @RequestBody CreateAppointmentRequest request) {
        return service.create(jwt.getSubject(), request);
    }

    @GetMapping("/next")
    public ResponseEntity<AppointmentResponse> next(@AuthenticationPrincipal Jwt jwt) {
        return service.next(jwt.getSubject()).map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','BARBERO')")
    public List<AppointmentResponse> agenda(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.agenda(date);
    }

    @PatchMapping("/{id}/status")
    public AppointmentResponse changeStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                                            @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(jwt.getSubject(), CurrentUser.role(), id, request.status());
    }
}
