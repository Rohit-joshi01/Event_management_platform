package com.aftr.controller;

import com.aftr.dto.PageResponse;
import com.aftr.dto.UserDtos;
import com.aftr.entity.Role;
import com.aftr.entity.UserStatus;
import com.aftr.security.AuthUser;
import com.aftr.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User management")
@PreAuthorize("hasRole('ADMIN')")
public class UserAdminController {

    private final UserService userService;

    public UserAdminController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public PageResponse<UserDtos.AdminUserResponse> list(@RequestParam(required = false) String q,
                                                         @RequestParam(required = false) Role role,
                                                         @RequestParam(required = false) UserStatus status,
                                                         @RequestParam(defaultValue = "0") int page,
                                                         @RequestParam(defaultValue = "20") int size,
                                                         @RequestParam(defaultValue = "createdAt") String sort,
                                                         @RequestParam(defaultValue = "desc") String direction) {
        return userService.search(q, role, status, page, size, sort, direction);
    }

    @GetMapping("/{id}")
    public UserDtos.AdminUserResponse get(@PathVariable Long id) {
        return userService.getForAdmin(id);
    }

    @PatchMapping("/{id}")
    public UserDtos.AdminUserResponse update(@PathVariable Long id, @Valid @RequestBody UserDtos.AdminUpdateUserRequest req,
                                             @AuthenticationPrincipal AuthUser me) {
        return userService.adminUpdate(id, req, me);
    }

    @PostMapping("/{id}/suspend")
    public UserDtos.AdminUserResponse suspend(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        return userService.setStatus(id, UserStatus.SUSPENDED, me);
    }

    @PostMapping("/{id}/reactivate")
    public UserDtos.AdminUserResponse reactivate(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        return userService.setStatus(id, UserStatus.ACTIVE, me);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal AuthUser me) {
        userService.delete(id, me);
    }
}
