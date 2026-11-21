package com.jmbarber.api.users;

import java.time.Clock;
import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.appointments.AppointmentRepository;
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
    private final AppointmentRepository appointments;
    private final Clock clock;

    public UserAdminService(UserRepository users, AppointmentRepository appointments, Clock clock) {
        this.users = users;
        this.appointments = appointments;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public UsersPage list(int page, int size, Role role) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(50, Math.max(1, size));
        PageRequest request = PageRequest.of(safePage - 1, safeSize);
        Page<User> result = role == null
            ? users.findAllForAdmin(request)
            : users.findByRoleOrderByFirstNameAscLastNameAsc(role, request);
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

    /**
     * Borrado seguro (contrato §9, tarea 4.12): primero se cancelan sus citas activas que aún no han
     * pasado, para liberar los turnos; luego se borra el usuario y MySQL deja sus demás citas con
     * client_id = NULL (FK ON DELETE SET NULL), así la contabilidad no se descuadra.
     */
    @Transactional
    public void delete(String adminId, String userId) {
        if (userId.equals(adminId)) {
            throw ApiException.conflict("SELF_DELETE", SELF_DELETE);
        }
        find(userId); // 404 si no existe
        LocalDateTime now = LocalDateTime.now(clock);
        appointments.cancelUpcomingOf(userId, now.toLocalDate(), now.toLocalTime());
        users.delete(find(userId)); // se vuelve a leer: cancelUpcomingOf limpia el contexto de JPA
    }

    private User find(String id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }
}
