package com.jmbarber.api.services;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Tabla `services` (V1). Se llama BarberService para no confundirse con la
 * anotación @Service de Spring. Incluye la reserva fija para gastos (tarea 3.27).
 */
@Entity
@Table(name = "services")
public class BarberService {

    @Id
    @Column(columnDefinition = "char(36)")
    private String id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "short_name", nullable = false, length = 60)
    private String shortName;

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(length = 255)
    private String includes;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "duration_label", nullable = false, length = 30)
    private String durationLabel;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(name = "image_url", length = 255)
    private String imageUrl;

    @Column(nullable = false, length = 60)
    private String icon;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "reserve_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal reserveAmount = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected BarberService() {
        // requerido por JPA
    }

    public static BarberService create(String name, String shortName, String description, String includes,
                                       BigDecimal price, String durationLabel, int durationMinutes,
                                       String icon, String imageUrl, int sortOrder) {
        BarberService s = new BarberService();
        s.id = UUID.randomUUID().toString();
        s.name = name;
        s.shortName = shortName;
        s.description = description;
        s.includes = includes;
        s.price = price;
        s.durationLabel = durationLabel;
        s.durationMinutes = durationMinutes;
        s.icon = icon;
        s.imageUrl = imageUrl;
        s.sortOrder = sortOrder;
        s.active = true;
        s.reserveAmount = BigDecimal.ZERO;
        return s;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getShortName() { return shortName; }
    public String getDescription() { return description; }
    public String getIncludes() { return includes; }
    public BigDecimal getPrice() { return price; }
    public String getDurationLabel() { return durationLabel; }
    public int getDurationMinutes() { return durationMinutes; }
    public String getImageUrl() { return imageUrl; }
    public String getIcon() { return icon; }
    public boolean isActive() { return active; }
    public int getSortOrder() { return sortOrder; }
    public BigDecimal getReserveAmount() { return reserveAmount; }

    public void toggleActive() { this.active = !this.active; }
    public void setReserveAmount(BigDecimal reserveAmount) { this.reserveAmount = reserveAmount; }
}
