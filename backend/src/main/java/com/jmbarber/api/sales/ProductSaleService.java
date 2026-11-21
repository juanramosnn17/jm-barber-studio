package com.jmbarber.api.sales;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.jmbarber.api.appointments.AppointmentEnums.PaymentMethod;
import com.jmbarber.api.common.ApiException;
import com.jmbarber.api.sales.ProductSaleDtos.ProductSaleRequest;
import com.jmbarber.api.sales.ProductSaleDtos.ProductSaleResponse;

/** Ventas de productos (tarea 3.30). Solo ADMIN (lo exige el controlador). */
@Service
public class ProductSaleService {

    static final String ALREADY_VOIDED = "Esta venta ya está anulada.";
    static final String NOT_FOUND = "No se encontró la venta.";

    private final ProductSaleRepository sales;
    private final Clock clock;

    public ProductSaleService(ProductSaleRepository sales, Clock clock) {
        this.sales = sales;
        this.clock = clock;
    }

    @Transactional
    public ProductSaleResponse create(ProductSaleRequest req) {
        BigDecimal amount = req.amount().setScale(0, RoundingMode.HALF_UP); // pesos enteros
        if (amount.signum() <= 0) {
            throw ApiException.badRequest(ProductSaleDtos.REQUIRED);
        }
        LocalTime time = req.time() == null || req.time().isBlank()
            ? LocalTime.NOON : LocalTime.parse(req.time(), ProductSaleDtos.HH_MM);
        ProductSale sale = ProductSale.register(req.date(), time, req.concept().trim(), amount,
            req.paymentMethod() == null ? PaymentMethod.EFECTIVO : req.paymentMethod());
        return ProductSaleResponse.from(sales.save(sale));
    }

    @Transactional
    public ProductSaleResponse voidSale(String id, String reason) {
        ProductSale sale = find(id);
        if (sale.getStatus() == ProductSale.Status.ANULADO) {
            throw ApiException.conflict("SALE_VOIDED", ALREADY_VOIDED);
        }
        sale.voidWith(reason.trim(), Instant.now(clock));
        return ProductSaleResponse.from(sale);
    }

    @Transactional
    public void delete(String id) {
        sales.delete(find(id));
    }

    private ProductSale find(String id) {
        return sales.findById(id).orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }
}
