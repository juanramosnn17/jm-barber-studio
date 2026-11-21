package com.jmbarber.api.hours;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusinessHoursRepository extends JpaRepository<BusinessHours, Byte> {

    /**
     * Lee el horario bloqueando su fila única (SELECT … FOR UPDATE) hasta que termine la transacción.
     * Las reservas lo usan como cerrojo: MySQL no tiene restricciones de exclusión de rangos, así que
     * revisar el solapamiento y guardar ocurre de a una reserva a la vez (contrato §9, tarea 4.12).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from BusinessHours h where h.id = :id")
    Optional<BusinessHours> lockById(@Param("id") Byte id);
}
