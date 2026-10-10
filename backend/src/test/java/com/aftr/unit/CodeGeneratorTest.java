package com.aftr.unit;

import com.aftr.service.CodeGenerator;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CodeGeneratorTest {

    private final CodeGenerator codes = new CodeGenerator();

    @Test
    void bookingReferencesUseUnambiguousAlphabet() {
        for (int i = 0; i < 200; i++) {
            assertThat(codes.bookingReference()).matches("AFT-[A-HJ-NP-Z2-9]{6}");
        }
    }

    @Test
    void ticketCodesAreLongRandomAndUrlSafe() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String code = codes.ticketCode();
            assertThat(code).hasSize(32).matches("[A-Za-z0-9_-]+");
            assertThat(seen.add(code)).isTrue();
        }
    }

    @Test
    void slugsAreReadableAndSuffixed() {
        assertThat(codes.slug("Signal/Noise: Applied AI Summit")).matches("signal-noise-applied-ai-summit-[a-z2-9]{5}");
        assertThat(codes.slug("Café Ünïcode!")).startsWith("cafe-unicode-");
        assertThat(codes.slug("!!!")).startsWith("event-");
    }
}
