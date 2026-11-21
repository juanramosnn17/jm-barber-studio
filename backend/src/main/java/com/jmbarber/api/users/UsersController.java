package com.jmbarber.api.users;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.jmbarber.api.users.UserAdminDtos.UpdateUserRequest;
import com.jmbarber.api.users.UserAdminDtos.UsersPage;

/** /api/v1/users (docs/contratos/api-rest.md §5). Todo es solo para ADMIN. */
@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("hasRole('ADMIN')")
public class UsersController {

    private final UserAdminService service;

    public UsersController(UserAdminService service) {
        this.service = service;
    }

    @GetMapping
    public UsersPage list(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "6") int size) {
        return service.list(page, size);
    }

    @PutMapping("/{id}")
    public UserDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
                          @Valid @RequestBody UpdateUserRequest request) {
        return service.update(jwt.getSubject(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        service.delete(jwt.getSubject(), id);
    }
}
