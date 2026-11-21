package com.jmbarber.api.common;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Reloj de la barbería: toda regla de "ya pasó" usa la hora de Colombia (tarea 3.18). */
@Configuration
public class TimeConfig {

    public static final ZoneId STUDIO_ZONE = ZoneId.of("America/Bogota");

    @Bean
    public Clock studioClock() {
        return Clock.system(STUDIO_ZONE);
    }
}
