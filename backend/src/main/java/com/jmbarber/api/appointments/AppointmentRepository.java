package com.jmbarber.api.appointments;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppointmentRepository extends JpaRepository<Appointment, String> {

    /** Horas ocupadas del día, sin datos de nadie (equivale a get_booked_slots). */
    @Query("""
        select a.time from Appointment a
        where a.date = :date and a.status <> com.jmbarber.api.appointments.AppointmentEnums.Status.CANCELADA
        order by a.time""")
    List<LocalTime> findBookedTimes(@Param("date") LocalDate date);

    @Query("""
        select count(a) > 0 from Appointment a
        where a.date = :date and a.time = :time
          and a.status <> com.jmbarber.api.appointments.AppointmentEnums.Status.CANCELADA""")
    boolean isSlotTaken(@Param("date") LocalDate date, @Param("time") LocalTime time);

    /** Agenda del día para el personal, sin canceladas, por hora. */
    @Query("""
        select a from Appointment a join fetch a.client join fetch a.service
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

    /** Citas cobradas del periodo para el reporte contable (spec F5). */
    @Query("""
        select a from Appointment a join fetch a.client join fetch a.service
        where a.date between :start and :end
          and a.status = com.jmbarber.api.appointments.AppointmentEnums.Status.COMPLETADA
          and a.paymentStatus in (com.jmbarber.api.appointments.AppointmentEnums.PaymentStatus.PAGADO,
                                  com.jmbarber.api.appointments.AppointmentEnums.PaymentStatus.REEMBOLSADO)""")
    List<Appointment> findCollectedBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("select a from Appointment a join fetch a.client join fetch a.service where a.id = :id")
    Optional<Appointment> findWithDetails(@Param("id") String id);
}
