package com.aftr.service;

import com.aftr.dto.AdminDtos;
import com.aftr.dto.PageResponse;
import com.aftr.entity.AuditLog;
import com.aftr.repository.AuditLogRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class AuditQueryService {

    private final AuditLogRepository repository;

    public AuditQueryService(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminDtos.AuditLogResponse> search(String q, String action, String entityType, Instant from,
                                                           Instant to, int page, int size) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                p.add(cb.or(cb.like(cb.lower(root.<String>get("summary")), like),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("actorEmail"), "")), like)));
            }
            if (action != null && !action.isBlank()) p.add(cb.equal(root.get("action"), action.trim()));
            if (entityType != null && !entityType.isBlank()) p.add(cb.equal(root.get("entityType"), entityType.trim()));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            if (to != null) p.add(cb.lessThan(root.get("createdAt"), to));
            return cb.and(p.toArray(Predicate[]::new));
        };
        return PageResponse.of(repository.findAll(spec, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")))), AuditQueryService::toResponse);
    }

    public static AdminDtos.AuditLogResponse toResponse(AuditLog a) {
        return new AdminDtos.AuditLogResponse(a.getId(), a.getActorId(), a.getActorEmail(), a.getAction(),
                a.getEntityType(), a.getEntityId(), a.getSummary(), a.getIpAddress(), a.getCreatedAt());
    }
}
