package com.jmbarber.api.hours;

import jakarta.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.jmbarber.api.hours.BusinessHoursDtos.BusinessHoursRequest;
import com.jmbarber.api.hours.BusinessHoursDtos.BusinessHoursResponse;

/** /api/v1/business-hours (docs/contratos/api-rest.md §3). */
@RestController
@RequestMapping("/api/v1/business-hours")
public class BusinessHoursController {

    private final BusinessHoursService service;

    public BusinessHoursController(BusinessHoursService service) {
        this.service = service;
    }

    @GetMapping
    public BusinessHoursResponse get() {
        return service.get();
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public BusinessHoursResponse update(@Valid @RequestBody BusinessHoursRequest request) {
        return service.update(request);
    }
}
