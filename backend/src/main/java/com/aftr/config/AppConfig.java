package com.aftr.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.time.Clock;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class AppConfig implements WebMvcConfigurer {

    private final AppProperties props;

    public AppConfig(AppProperties props) {
        this.props = props;
    }

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize().toUri().toString();
        if (!location.endsWith("/")) {
            location = location + "/";
        }
        registry.addResourceHandler("/uploads/**").addResourceLocations(location);
    }
}
