package com.aftr.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI aftrOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("AFTR Event Platform API")
                        .version("v1")
                        .description("""
                                REST API for the AFTR online event management platform.

                                Authentication is session based: call POST /api/v1/auth/login, then send the
                                AFTR_SESSION cookie with subsequent requests. State-changing requests must echo
                                the XSRF-TOKEN cookie value in the X-XSRF-TOKEN header (GET /api/v1/auth/csrf
                                issues the cookie). Roles (ADMIN, ORGANIZER, ATTENDEE) are enforced server-side."""))
                .components(new Components().addSecuritySchemes("session",
                        new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE).name("AFTR_SESSION")))
                .addSecurityItem(new SecurityRequirement().addList("session"));
    }
}
