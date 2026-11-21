package com.jmbarber.api.appointments;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppointmentRepository extends JpaRepository<Appointment, String> {

    /** Horas de inicio ocupadas del día, sin datos de nadie (equivale a get_booked_slots). */
    @Query("""
        select a.time from Appointment a
        where a.date = :date and a.status <> com.jmbarber.api.appointments.AppointmentEnums.Status.CANCELADA
        order by a.time""")
    List<LocalTime> findBookedTimes(@Param("date") LocalDate date);

    /** Rangos [inicio, fin) ocupados del día, sin datos de nadie (tarea 4.12). Cada fila: {time, endTime}. */
    @Query("""
        select a.time, a.endTime from Appointment a
        where a.date = :date and a.status <> com.jmbarber.api.appointments.AppointmentEnums.Status.CANCELADA
        order by a.time""")
    List<Object[]> findBookedRanges(@Param("date") LocalDate date);

    /**
     * ¿Algún rango activo del día se cruza con [start, end)? Dos rangos se cruzan si cada uno
     * empieza antes de que termine el otro. excludeId permite ignorar la propia cita al reactivarla.
     */
    @Query("""
        select count(a) > 0 from Appointment a
        where a.date = :date and a.id <> :excludeId
          and a.status <> com.jmbarber.api.appointments.AppointmentEnums.Status.CANCELADA
          and a.time < :end and a.endTime > :start""")
    boolean overlaps(@Param("date") LocalDate date, @Param("start") LocalTime start,
                     @Param("end") LocalTime end, @Param("excludeId") String excludeId);

    /** Agenda del día para el personal, sin canceladas, por hora (incluye citas de clientes eliminados). */
    @Query("""
        select a from Appointment a left join fetch a.client join fetch a.service
        where a.date = :date and a.status <> com.jmbarber.api.appointments.AppointmentEnums.Status.CANCELADA
        order by a.time""")
    List<Appointment> findAgenda(@Param("date") LocalDate date);

    /** Próximas citas activas de un usuario que aún no han pasado. */
    @Query("""
        select a from Appointment a join fetch a.client join fetch a.service
        where a.client.id = :clientId
          and a.status in (com.jmbarber.api.appointments.AppointmentEnums.Status.PENDIENTE,
                           com.jmbarber.api.appointments.AppointmentEnums.Status.CONFIRMADA)
          and (a.date > :today or (a.date = :today and a.time > :now))
        order by a.date, a.time""")
    List<Appointment> findUpcoming(@Param("clientId") String clientId, @Param("today") LocalDate today,
                                   @Param("now") LocalTime now, Pageable page);

    /** Citas cobradas del periodo para el reporte contable (spec F5), también de clientes eliminados. */
    @Query("""
        select a from Appointment a left join fetch a.client join fetch a.service
        where a.date between :start and :end
          and a.status = com.jmbarber.api.appointments.AppointmentEnums.Status.COMPLETADA
          and a.paymentStatus in (com.jmbarber.api.appointments.AppointmentEnums.PaymentStatus.PAGADO,
                                  com.jmbarber.api.appointments.AppointmentEnums.PaymentStatus.REEMBOLSADO)""")
    List<Appointment> findCollectedBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("select a from Appointment a left join fetch a.client join fetch a.service where a.id = :id")
    Optional<Appointment> findWithDetails(@Param("id") String id);

    /**
     * Antes de borrar un usuario: cancela sus citas activas que aún no han pasado para liberar
     * los turnos (contrato §9). Devuelve cuántas canceló.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        update Appointment a
        set a.status = com.jmbarber.api.appointments.AppointmentEnums.Status.CANCELADA,
            a.paymentStatus = com.jmbarber.api.appointments.AppointmentEnums.PaymentStatus.ANULADO
        where a.client.id = :clientId
          and a.status in (com.jmbarber.api.appointments.AppointmentEnums.Status.PENDIENTE,
                           com.jmbarber.api.appointments.AppointmentEnums.Status.CONFIRMADA)
          and (a.date > :today or (a.date = :today and a.time > :now))""")
    int cancelUpcomingOf(@Param("clientId") String clientId, @Param("today") LocalDate today,
                         @Param("now") LocalTime now);
}
