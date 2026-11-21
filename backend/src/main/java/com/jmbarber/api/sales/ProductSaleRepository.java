package com.jmbarber.api.sales;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductSaleRepository extends JpaRepository<ProductSale, String> {

    /** Todas las ventas del periodo, también las anuladas (el reporte las muestra sin sumarlas). */
    List<ProductSale> findByDateBetween(LocalDate start, LocalDate end);
}
