package com.jmbarber.api.users;

/** Usuario tal como lo ve el frontend. Nunca incluye la contraseña. */
public record UserDto(String id, String firstName, String lastName, String email, String phone, Role role) {

    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getFirstName(), u.getLastName(), u.getEmail(), u.getPhone(), u.getRole());
    }
}
