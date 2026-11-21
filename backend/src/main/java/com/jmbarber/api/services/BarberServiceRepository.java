package com.jmbarber.api.services;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BarberServiceRepository extends JpaRepository<BarberService, String> {

    List<BarberService> findAllByOrderBySortOrderAsc();

    List<BarberService> findByActiveTrueOrderBySortOrderAsc();

    @Query("select coalesce(max(s.sortOrder), 0) from BarberService s")
    int maxSortOrder();
}
