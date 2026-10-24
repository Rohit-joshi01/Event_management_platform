package com.aftr;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class AftrApplication {

    public static void main(String[] args) {
        // All timestamps are stored in UTC. Pinning the JVM zone also avoids legacy zone ids
        // (e.g. Windows reports "Asia/Calcutta") that PostgreSQL rejects when the driver connects.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(AftrApplication.class, args);
    }
}
