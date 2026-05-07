package com.example.prononciationtest.service;

import com.example.prononciationtest.service.iservice.IFileStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;

@Service
public class FileStorageService implements IFileStorageService {

    @Value("${app.storage.video-dir:./storage/videos}")
    private String videoDir;

    @Value("${app.storage.audio-dir:./storage/audio}")
    private String audioDir;

    @Value("${app.storage.image-dir:./storage/images}")
    private String imageDir;

    private static final long         MAX_SIZE = 500 * 1024 * 1024L; // 500 MB
    private static final List<String> VIDEO    = List.of("mp4", "webm", "mov", "avi", "mkv");
    private static final List<String> AUDIO    = List.of("mp3", "wav", "webm", "ogg", "m4a", "aac");
    private static final List<String> IMAGE    = List.of("jpg", "jpeg", "png", "webp");

    // ── Vidéo de leçon → /storage/videos/course_X/uuid.mp4 ──────────────────
    public String saveVideo(MultipartFile file, Long courseId) throws IOException {
        validate(file, VIDEO);
        Path dir = Paths.get(videoDir, "course_" + courseId);
        Files.createDirectories(dir);
        String filename = UUID.randomUUID() + "." + ext(file);
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        return "/storage/videos/course_" + courseId + "/" + filename;
    }

    // ── Audio de leçon → /storage/audio/course_X/uuid.mp3 ───────────────────
    public String saveLessonAudio(MultipartFile file, Long courseId) throws IOException {
        validate(file, AUDIO);
        Path dir = Paths.get(audioDir, "course_" + courseId);
        Files.createDirectories(dir);
        String filename = UUID.randomUUID() + "." + ext(file);
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        return "/storage/audio/course_" + courseId + "/" + filename;
    }

    // ── Audio utilisateur (prononciation) → /storage/audio/user_X/uuid.wav ──
    public String saveAudio(MultipartFile file, Long userId) throws IOException {
        validate(file, AUDIO);
        Path dir = Paths.get(audioDir, "user_" + userId);
        Files.createDirectories(dir);
        String filename = UUID.randomUUID() + "." + ext(file);
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        return "/storage/audio/user_" + userId + "/" + filename;
    }

    // ── Image / thumbnail → /storage/images/course_X/uuid.jpg ───────────────
    public String saveImage(MultipartFile file, Long courseId) throws IOException {
        validate(file, IMAGE);
        Path dir = Paths.get(imageDir, "course_" + courseId);
        Files.createDirectories(dir);
        String filename = UUID.randomUUID() + "." + ext(file);
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        return "/storage/images/course_" + courseId + "/" + filename;
    }

    // ── Suppression ───────────────────────────────────────────────────────────
    public void deleteFile(String relativePath) {
        try {
            Files.deleteIfExists(Paths.get("." + relativePath));
        } catch (IOException e) {
            System.out.println("[Storage] Suppression échouée : " + relativePath);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private void validate(MultipartFile file, List<String> allowed) {
        if (file == null || file.isEmpty())
            throw new RuntimeException("Fichier vide");
        if (file.getSize() > MAX_SIZE)
            throw new RuntimeException("Fichier trop volumineux (max 500MB)");
        if (!allowed.contains(ext(file)))
            throw new RuntimeException("Format non autorisé. Acceptés : " + allowed);
    }

    private String ext(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || !name.contains(".")) return "mp4";
        return name.substring(name.lastIndexOf('.') + 1).toLowerCase();
    }
}