package com.aftr.controller;

import com.aftr.dto.AdminDtos;
import com.aftr.dto.EventDtos;
import com.aftr.service.EventService;
import com.aftr.service.SettingsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Discovery")
public class CategoryController {

    private final EventService eventService;
    private final SettingsService settingsService;

    public CategoryController(EventService eventService, SettingsService settingsService) {
        this.eventService = eventService;
        this.settingsService = settingsService;
    }

    @GetMapping("/categories")
    public List<EventDtos.CategoryResponse> categories() {
        return eventService.categories();
    }

    @GetMapping("/settings/public")
    public AdminDtos.PublicSettings publicSettings() {
        return settingsService.publicSettings();
    }
}
