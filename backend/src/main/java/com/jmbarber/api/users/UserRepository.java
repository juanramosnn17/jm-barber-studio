package com.jmbarber.api.users;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** Listado del admin: primero administradores, luego barberos y clientes; dentro de cada rol, por nombre. */
    @Query(value = """
        select u from User u order by
          case u.role when com.jmbarber.api.users.Role.ADMIN then 0
                      when com.jmbarber.api.users.Role.BARBERO then 1 else 2 end,
          u.firstName, u.lastName""",
        countQuery = "select count(u) from User u")
    Page<User> findAllForAdmin(Pageable pageable);
}
