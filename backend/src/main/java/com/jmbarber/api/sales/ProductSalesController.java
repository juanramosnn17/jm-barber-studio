package com.jmbarber.api.sales;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.jmbarber.api.expenses.ExpenseDtos.VoidRequest;
import com.jmbarber.api.sales.ProductSaleDtos.ProductSaleRequest;
import com.jmbarber.api.sales.ProductSaleDtos.ProductSaleResponse;

/** /api/v1/product-sales (docs/contratos/api-rest.md §6b). Todo es solo para ADMIN. */
@RestController
@RequestMapping("/api/v1/product-sales")
@PreAuthorize("hasRole('ADMIN')")
public class ProductSalesController {

    private final ProductSaleService service;

    public ProductSalesController(ProductSaleService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductSaleResponse create(@Valid @RequestBody ProductSaleRequest request) {
        return service.create(request);
    }

    /** Mismo cuerpo y mensaje que anular un gasto: { reason } obligatorio. */
    @PostMapping("/{id}/void")
    public ProductSaleResponse voidSale(@PathVariable String id, @Valid @RequestBody VoidRequest request) {
        return service.voidSale(id, request.reason());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }
}
