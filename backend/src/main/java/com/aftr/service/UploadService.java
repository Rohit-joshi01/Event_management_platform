package com.aftr.service;

import com.aftr.config.AppProperties;
import com.aftr.dto.UploadResponse;
import com.aftr.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/** Stores validated image uploads on local disk under app.uploads.dir and serves them at /uploads/**. */
@Service
public class UploadService {

    private final AppProperties props;

    public UploadService(AppProperties props) {
        this.props = props;
    }

    public UploadResponse storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "Choose an image to upload.");
        }
        if (file.getSize() > props.getUploads().getMaxBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Images must be 5 MB or smaller.");
        }
        String ext;
        byte[] head = new byte[12];
        try (InputStream in = file.getInputStream()) {
            int n = in.readNBytes(head, 0, head.length);
            ext = detect(head, n);
        } catch (IOException e) {
            throw ApiException.badRequest("UNREADABLE_FILE", "The file couldn't be read.");
        }
        if (ext == null) {
            throw ApiException.badRequest("UNSUPPORTED_TYPE", "Upload a JPEG, PNG or WebP image.");
        }
        try {
            Path dir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
            Files.createDirectories(dir);
            String name = UUID.randomUUID() + "." + ext;
            Path target = dir.resolve(name).normalize();
            if (!target.startsWith(dir)) {
                throw ApiException.badRequest("INVALID_PATH", "Invalid file name.");
            }
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return new UploadResponse("/uploads/" + name, file.getSize(), "image/" + (ext.equals("jpg") ? "jpeg" : ext));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "The image couldn't be saved.");
        }
    }

    /** Identifies the format from magic bytes rather than trusting the client's Content-Type. */
    private static String detect(byte[] b, int n) {
        if (n >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "jpg";
        if (n >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "png";
        if (n >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
        return null;
    }
}
