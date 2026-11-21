package com.jmbarber.api.users;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.common.ApiException;
import com.jmbarber.api.users.UserAdminDtos.UpdateUserRequest;
import com.jmbarber.api.users.UserAdminDtos.UsersPage;

/** Administración de usuarios (spec F4). Solo la usa un ADMIN (lo exige el controlador). */
@Service
public class UserAdminService {

    static final String SELF_DEMOTE = "No puedes quitarte a ti mismo el rol de administrador.";
    static final String SELF_DELETE = "No puedes eliminar tu propia cuenta.";
    static final String EMAIL_TAKEN = "Ya existe una cuenta con ese correo.";
    static final String NOT_FOUND = "El usuario no existe.";

    private final UserRepository users;

    public UserAdminService(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public UsersPage list(int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(50, Math.max(1, size));
        Page<User> result = users.findAllForAdmin(PageRequest.of(safePage - 1, safeSize));
        return new UsersPage(result.map(UserDto::from).getContent(), result.getTotalElements());
    }

    @Transactional
    public UserDto update(String adminId, String userId, UpdateUserRequest req) {
        User user = find(userId);
        if (user.getId().equals(adminId) && req.role() != Role.ADMIN) {
            throw ApiException.conflict("SELF_DEMOTE", SELF_DEMOTE);
        }
        String email = req.email().trim().toLowerCase();
        users.findByEmail(email)
            .filter(other -> !other.getId().equals(user.getId()))
            .ifPresent(other -> {
                throw ApiException.conflict("EMAIL_TAKEN", EMAIL_TAKEN);
            });

        user.setFirstName(req.firstName().trim());
        user.setLastName(req.lastName() == null ? "" : req.lastName().trim());
        user.setEmail(email);
        user.setPhone(req.phone() == null || req.phone().isBlank() ? null : req.phone().trim());
        user.setRole(req.role());
        return UserDto.from(user);
    }

    @Transactional
    public void delete(String adminId, String userId) {
        if (userId.equals(adminId)) {
            throw ApiException.conflict("SELF_DELETE", SELF_DELETE);
        }
        users.delete(find(userId)); // sus citas se borran en cascada (FK ON DELETE CASCADE)
    }

    private User find(String id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }
}
