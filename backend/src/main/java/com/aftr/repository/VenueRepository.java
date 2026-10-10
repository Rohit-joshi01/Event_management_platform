package com.aftr.repository;

import com.aftr.entity.Venue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {

    Optional<Venue> findFirstByNameIgnoreCaseAndCityIgnoreCase(String name, String city);
}
