package com.jmbarber.api.hours;

import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Tabla `business_hours`: una sola fila (id = 1). Días 0 = domingo … 6 = sábado. */
@Entity
@Table(name = "business_hours")
public class BusinessHours {

    public static final byte SINGLE_ROW_ID = 1;

    @Id
    private Byte id;

    @Column(name = "open_days", nullable = false, length = 20)
    private String openDays;

    @Column(name = "open_time", nullable = false)
    private LocalTime openTime;

    @Column(name = "close_time", nullable = false)
    private LocalTime closeTime;

    @Column(name = "break_start")
    private LocalTime breakStart;

    @Column(name = "break_end")
    private LocalTime breakEnd;

    @Column(name = "slot_minutes", nullable = false)
    private int slotMinutes;

    protected BusinessHours() {
        // requerido por JPA
    }

    public List<Integer> getOpenDays() {
        if (openDays == null || openDays.isBlank()) {
            return List.of();
        }
        return Arrays.stream(openDays.split(",")).map(String::trim).map(Integer::valueOf).sorted().toList();
    }

    public LocalTime getOpenTime() { return openTime; }
    public LocalTime getCloseTime() { return closeTime; }
    public LocalTime getBreakStart() { return breakStart; }
    public LocalTime getBreakEnd() { return breakEnd; }
    public int getSlotMinutes() { return slotMinutes; }

    public void update(List<Integer> days, LocalTime open, LocalTime close,
                       LocalTime breakStart, LocalTime breakEnd, int slotMinutes) {
        this.openDays = days.stream().distinct().sorted().map(String::valueOf).collect(Collectors.joining(","));
        this.openTime = open;
        this.closeTime = close;
        this.breakStart = breakStart;
        this.breakEnd = breakEnd;
        this.slotMinutes = slotMinutes;
    }
}
