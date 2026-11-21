package com.jmbarber.api.users;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Tabla `users` (V1__esquema_inicial.sql). La contraseña solo se guarda cifrada con BCrypt. */
@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(columnDefinition = "char(36)")
    private String id;

    @Column(name = "first_name", nullable = false, length = 80)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 80)
    private String lastName = "";

    @Column(nullable = false, length = 160)
    private String email;

    @Column(length = 30)
    private String phone;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "enum('CLIENTE','BARBERO','ADMIN')")
    private Role role = Role.CLIENTE;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {
        // requerido por JPA
    }

    /** Nuevo cliente: el rol siempre es CLIENTE (solo un admin lo cambia después). */
    public static User newClient(String firstName, String lastName, String email, String phone, String passwordHash) {
        User u = new User();
        u.id = UUID.randomUUID().toString();
        u.firstName = firstName;
        u.lastName = lastName == null ? "" : lastName;
        u.email = email;
        u.phone = phone;
        u.passwordHash = passwordHash;
        u.role = Role.CLIENTE;
        return u;
    }

    public String getId() { return id; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public Instant getCreatedAt() { return createdAt; }

    public void setFirstName(String firstName) { this.firstName = firstName; }
    public void setLastName(String lastName) { this.lastName = lastName == null ? "" : lastName; }
    public void setEmail(String email) { this.email = email; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setRole(Role role) { this.role = role; }
}
