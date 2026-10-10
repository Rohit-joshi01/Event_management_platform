package com.aftr.repository;

import com.aftr.entity.Announcement;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    @EntityGraph(attributePaths = {"sender", "event"})
    List<Announcement> findByEventIdOrderByCreatedAtDesc(Long eventId);

    @EntityGraph(attributePaths = {"sender", "event"})
    List<Announcement> findByEventOrganizerIdOrderByCreatedAtDesc(Long organizerId);
}
