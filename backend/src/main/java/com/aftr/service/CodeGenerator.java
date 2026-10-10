package com.aftr.service;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.Base64;
import java.util.Locale;

/** Generates booking references, unguessable ticket codes and URL slugs. */
@Component
public class CodeGenerator {

    private static final char[] REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final char[] SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789".toCharArray();
    private final SecureRandom random = new SecureRandom();

    /** Human-friendly booking reference, e.g. AFT-7KQ2MX. */
    public String bookingReference() {
        return "AFT-" + randomString(REF_ALPHABET, 6);
    }

    /** 192 bits of randomness, URL-safe. Encoded in the QR code; reveals nothing about the holder. */
    public String ticketCode() {
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String slug(String title) {
        String base = Normalizer.normalize(title, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.length() > 120) base = base.substring(0, 120).replaceAll("-$", "");
        if (base.isEmpty()) base = "event";
        return base + "-" + randomString(SLUG_ALPHABET, 5);
    }

    private String randomString(char[] alphabet, int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(alphabet[random.nextInt(alphabet.length)]);
        }
        return sb.toString();
    }
}
