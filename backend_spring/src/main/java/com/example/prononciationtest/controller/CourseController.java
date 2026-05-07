package com.example.prononciationtest.controller;

import com.example.prononciationtest.entity.*;
import com.example.prononciationtest.repository.*;
import com.example.prononciationtest.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@CrossOrigin(origins = "http://localhost:8081")
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseRepository courseRepo;
    private final LessonRepository lessonRepo;
    private final UserCourseProgressRepository progressRepo;
    private final UserRepository userRepo;
    private final FileStorageService storageService;
    private final LessonProgressRepository lessonProgressRepo;

    // ── 1. Tous les cours ────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<?> getAllCourses(
            @RequestParam(defaultValue = "fr") String lang) {
        return ResponseEntity.ok(courseRepo.findByLangAndActiveTrue(lang));
    }

    // ── 2. Cours recommandés ─────────────────────────────────────────────────
    @GetMapping("/recommended")
    public ResponseEntity<?> getRecommended(
            @RequestParam(defaultValue = "fr") String lang,
            Authentication auth) {

        User user = getUser(auth);
        String cefrLevel = user.getCefrLevel() != null ? user.getCefrLevel() : "B1";

        List<Course> current = courseRepo
                .findByCefrLevelAndLangAndActiveTrueOrderByDisplayOrderAsc(cefrLevel, lang);

        String nextLevel = getNextLevel(cefrLevel);
        List<Course> next = nextLevel != null
                ? courseRepo.findByCefrLevelAndLangAndActiveTrueOrderByDisplayOrderAsc(nextLevel, lang)
                : List.of();

        Map<String, Object> response = new HashMap<>();
        response.put("user_level",            cefrLevel);
        response.put("current_level_courses", current);
        response.put("next_level_courses",    next);
        return ResponseEntity.ok(response);
    }

    // ── 3. Cours par niveau ──────────────────────────────────────────────────
    @GetMapping("/level/{cefrLevel}")
    public ResponseEntity<?> getCoursesByLevel(
            @PathVariable String cefrLevel,
            @RequestParam(defaultValue = "fr") String lang) {
        return ResponseEntity.ok(
                courseRepo.findByCefrLevelAndLangAndActiveTrueOrderByDisplayOrderAsc(cefrLevel, lang)
        );
    }

    // ── 4. Détail d'un cours avec ses leçons ─────────────────────────────────
    @GetMapping("/{courseId}")
    public ResponseEntity<?> getCourseDetail(
            @PathVariable Long courseId,
            Authentication auth) {

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Cours introuvable"));

        List<Lesson> lessons = lessonRepo
                .findByCourseIdAndActiveTrueOrderByLessonOrderAsc(courseId);

        Map<String, Object> response = new HashMap<>();
        response.put("course",   course);
        response.put("lessons",  lessons);

        // Progress is only meaningful for authenticated users (not admin key)
        if (auth != null && !(auth instanceof org.springframework.security.authentication.UsernamePasswordAuthenticationToken upt && "admin".equals(upt.getPrincipal()))) {
            Optional<UserCourseProgress> progress = progressRepo
                    .findByUserIdAndCourseId(getUser(auth).getId(), courseId);
            response.put("progress", progress.orElse(null));
        }
        return ResponseEntity.ok(response);
    }

    // ── 5. Créer un cours ────────────────────────────────────────────────────
    // ✅ consumes = MULTIPART_FORM_DATA_VALUE obligatoire
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createCourse(
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam String cefrLevel,
            @RequestParam(defaultValue = "fr") String lang,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer durationMinutes,
            @RequestParam(defaultValue = "0") Integer displayOrder,
            @RequestParam(required = false) MultipartFile thumbnail) throws Exception {

        Course course = new Course();
        course.setTitle(title);
        course.setDescription(description);
        course.setCefrLevel(cefrLevel);
        course.setLang(lang);
        course.setCategory(category);
        course.setDurationMinutes(durationMinutes);
        course.setDisplayOrder(displayOrder);
        course.setActive(true);

        if (thumbnail != null && !thumbnail.isEmpty()) {
            String thumbUrl = storageService.saveImage(thumbnail, 0L);
            course.setThumbnailUrl(thumbUrl);
        }

        courseRepo.save(course);
        return ResponseEntity.ok(course);
    }

    // ── 6. Créer une leçon ───────────────────────────────────────────────────
    // ✅ consumes = MULTIPART_FORM_DATA_VALUE obligatoire
    @PostMapping(path = "/{courseId}/lessons",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createLesson(
            @PathVariable Long courseId,
            @RequestParam String title,
            @RequestParam(defaultValue = "video") String type,
            @RequestParam(required = false) String content,
            @RequestParam(defaultValue = "0") Integer lessonOrder,
            @RequestParam(required = false) Integer durationMinutes) {

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Cours introuvable"));

        Lesson lesson = new Lesson();
        lesson.setCourse(course);
        lesson.setTitle(title);
        lesson.setType(type);
        lesson.setContent(content);
        lesson.setLessonOrder(lessonOrder);
        lesson.setDurationMinutes(durationMinutes);
        lesson.setActive(true);

        lessonRepo.save(lesson);
        return ResponseEntity.ok(lesson);
    }

    // ── 7. Upload vidéo pour une leçon ───────────────────────────────────────
    @PostMapping(path = "/{courseId}/lessons/{lessonId}/upload-video",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadVideo(
            @PathVariable Long courseId,
            @PathVariable Long lessonId,
            @RequestParam MultipartFile file) throws Exception {

        Lesson lesson = lessonRepo.findById(lessonId)
                .orElseThrow(() -> new RuntimeException("Leçon introuvable"));

        if (lesson.getContent() != null && lesson.getContent().startsWith("/storage")) {
            storageService.deleteFile(lesson.getContent());
        }

        String videoUrl = storageService.saveVideo(file, courseId);
        lesson.setContent(videoUrl);
        lesson.setType("video");
        lessonRepo.save(lesson);

        return ResponseEntity.ok(Map.of(
                "message",   "Vidéo uploadée avec succès",
                "video_url", videoUrl,
                "lesson_id", lessonId
        ));
    }

    // ── 7b. Upload audio pour une leçon (histoire, narration, exercice) ──────
    @PostMapping(path = "/{courseId}/lessons/{lessonId}/upload-audio",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadAudio(
            @PathVariable Long courseId,
            @PathVariable Long lessonId,
            @RequestParam MultipartFile file) throws Exception {

        Lesson lesson = lessonRepo.findById(lessonId)
                .orElseThrow(() -> new RuntimeException("Leçon introuvable"));

        if (lesson.getContent() != null && lesson.getContent().startsWith("/storage")) {
            storageService.deleteFile(lesson.getContent());
        }

        String audioUrl = storageService.saveLessonAudio(file, courseId);
        lesson.setContent(audioUrl);
        lesson.setType("audio");
        lessonRepo.save(lesson);

        return ResponseEntity.ok(Map.of(
                "message",   "Audio uploadé avec succès",
                "audio_url", audioUrl,
                "lesson_id", lessonId
        ));
    }

    // ── 8. S'inscrire à un cours ──────────────────────────────────────────────
    @PostMapping("/{courseId}/enroll")
    public ResponseEntity<?> enrollCourse(
            @PathVariable Long courseId,
            Authentication auth) {

        User user = getUser(auth);

        Optional<UserCourseProgress> existing = progressRepo
                .findByUserIdAndCourseId(user.getId(), courseId);

        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of(
                    "message",  "Déjà inscrit",
                    "progress", existing.get()
            ));
        }

        UserCourseProgress progress = new UserCourseProgress();
        progress.setUserId(user.getId());
        progress.setCourseId(courseId);
        progress.setStatus("enrolled");
        progress.setProgressPercent(0);
        progressRepo.save(progress);

        return ResponseEntity.ok(Map.of(
                "message",  "Inscription réussie",
                "progress", progress
        ));
    }

    // ── 9. Mettre à jour la progression ──────────────────────────────────────
    @PutMapping("/{courseId}/progress")
    public ResponseEntity<?> updateProgress(
            @PathVariable Long courseId,
            @RequestParam Integer percent,
            Authentication auth) {

        User user = getUser(auth);

        UserCourseProgress progress = progressRepo
                .findByUserIdAndCourseId(user.getId(), courseId)
                .orElseGet(() -> {
                    UserCourseProgress p = new UserCourseProgress();
                    p.setUserId(user.getId());
                    p.setCourseId(courseId);
                    return p;
                });

        progress.setProgressPercent(Math.min(100, Math.max(0, percent)));
        progress.setLastAccessedAt(LocalDateTime.now());

        if (percent >= 100) {
            progress.setStatus("completed");
            progress.setCompletedAt(LocalDateTime.now());
        } else if (percent > 0) {
            progress.setStatus("in_progress");
        }

        progressRepo.save(progress);
        return ResponseEntity.ok(progress);
    }

    // ── 10. Mes cours ─────────────────────────────────────────────────────────
    @GetMapping("/my-courses")
    public ResponseEntity<?> getMyCourses(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Non authentifié"));
        }

        User user = getUser(auth);
        List<UserCourseProgress> progressList = progressRepo.findByUserId(user.getId());

        List<Map<String, Object>> result = new ArrayList<>();
        for (UserCourseProgress p : progressList) {
            courseRepo.findById(p.getCourseId()).ifPresent(course -> {
                Map<String, Object> item = new HashMap<>();
                item.put("course",   course);
                item.put("progress", p);
                result.add(item);
            });
        }
        return ResponseEntity.ok(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private String getEmail(Authentication auth) {
        if (auth instanceof JwtAuthenticationToken jwt) {
            String email = jwt.getToken().getClaimAsString("email");
            if (email != null && !email.isBlank()) return email;
            String pref = jwt.getToken().getClaimAsString("preferred_username");
            if (pref != null && pref.contains("@")) return pref;
        }
        return auth.getName();
    }

    private User getUser(Authentication auth) {
        String email = getEmail(auth);
        return userRepo.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setPasswordHash("KC_MANAGED");
            u.setCreatedAt(Instant.now());
            u.setEnabled(true);
            return userRepo.save(u);
        });
    }

    private String getNextLevel(String current) {
        List<String> levels = List.of("A1", "A2", "B1", "B2", "C1", "C2");
        int idx = levels.indexOf(current);
        return (idx >= 0 && idx < levels.size() - 1) ? levels.get(idx + 1) : null;
    }


    // ── 11. Marquer une leçon comme complétée ─────────────────────────────────
    @PutMapping("/{courseId}/lessons/{lessonId}/complete")
    @Transactional
    public ResponseEntity<?> completeLesson(
            @PathVariable Long courseId,
            @PathVariable Long lessonId,
            Authentication auth) {

        User user = getUser(auth);

        // Upsert lesson_progress
        LessonProgress lp = lessonProgressRepo
                .findByUserIdAndLessonId(user.getId(), lessonId)
                .orElseGet(() -> {
                    LessonProgress n = new LessonProgress();
                    n.setUserId(user.getId());
                    n.setLessonId(lessonId);
                    n.setCourseId(courseId);
                    return n;
                });
        lp.setCompleted(true);
        lp.setCompletedAt(java.time.LocalDateTime.now());
        lessonProgressRepo.save(lp);

        // Recalculate course progress
        long totalLessons = lessonRepo.countByCourseIdAndActiveTrue(courseId);
        long doneLessons  = lessonProgressRepo
                .countByUserIdAndCourseIdAndCompletedTrue(user.getId(), courseId);

        int pct = totalLessons > 0 ? (int) Math.round((doneLessons * 100.0) / totalLessons) : 0;

        UserCourseProgress progress = progressRepo
                .findByUserIdAndCourseId(user.getId(), courseId)
                .orElseGet(() -> {
                    UserCourseProgress p = new UserCourseProgress();
                    p.setUserId(user.getId());
                    p.setCourseId(courseId);
                    return p;
                });

        progress.setProgressPercent(Math.min(100, pct));
        progress.setLastAccessedAt(java.time.LocalDateTime.now());
        if (pct >= 100) {
            progress.setStatus("completed");
            progress.setCompletedAt(java.time.LocalDateTime.now());
        } else {
            progress.setStatus("in_progress");
        }
        progressRepo.save(progress);

        return ResponseEntity.ok(Map.of(
                "lessonId",        lessonId,
                "completed",       true,
                "progressPercent", pct
        ));
    }

    // ── 12. Récupérer la progression par leçon ────────────────────────────────
    @GetMapping("/{courseId}/lesson-progress")
    public ResponseEntity<?> getLessonProgress(
            @PathVariable Long courseId,
            Authentication auth) {

        User user = getUser(auth);
        List<LessonProgress> rows = lessonProgressRepo
                .findByUserIdAndCourseId(user.getId(), courseId);

        Map<Long, Boolean> result = new HashMap<>();
        for (LessonProgress lp : rows) {
            result.put(lp.getLessonId(), lp.isCompleted());
        }
        return ResponseEntity.ok(result);
    }

    // ── 13. Modifier un cours ─────────────────────────────────────────────────
    @PutMapping(path = "/{courseId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateCourse(
            @PathVariable Long courseId,
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam String cefrLevel,
            @RequestParam(defaultValue = "fr") String lang,
            @RequestParam(required = false) MultipartFile thumbnail) throws Exception {

        Course course = courseRepo.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Cours introuvable"));

        course.setTitle(title);
        course.setDescription(description);
        course.setCefrLevel(cefrLevel);
        course.setLang(lang);

        if (thumbnail != null && !thumbnail.isEmpty()) {
            if (course.getThumbnailUrl() != null && course.getThumbnailUrl().startsWith("/storage")) {
                storageService.deleteFile(course.getThumbnailUrl());
            }
            String thumbUrl = storageService.saveImage(thumbnail, courseId);
            course.setThumbnailUrl(thumbUrl);
        }

        courseRepo.save(course);
        return ResponseEntity.ok(course);
    }

    // ── 14. Modifier une leçon ────────────────────────────────────────────────
    @PutMapping(path = "/{courseId}/lessons/{lessonId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateLesson(
            @PathVariable Long courseId,
            @PathVariable Long lessonId,
            @RequestParam String title,
            @RequestParam(required = false) MultipartFile file) throws Exception {

        Lesson lesson = lessonRepo.findById(lessonId)
                .orElseThrow(() -> new RuntimeException("Leçon introuvable"));

        lesson.setTitle(title);

        if (file != null && !file.isEmpty()) {
            if (lesson.getContent() != null && lesson.getContent().startsWith("/storage")) {
                storageService.deleteFile(lesson.getContent());
            }
            String videoUrl = storageService.saveVideo(file, courseId);
            lesson.setContent(videoUrl);
            lesson.setType("video");
        }

        lessonRepo.save(lesson);
        return ResponseEntity.ok(lesson);
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<?> deleteCourse(@PathVariable Long courseId, Authentication auth) {
        courseRepo.deleteById(courseId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{courseId}/lessons/{lessonId}")
    public ResponseEntity<?> deleteLesson(@PathVariable Long courseId, @PathVariable Long lessonId) {
        lessonRepo.deleteById(lessonId);
        return ResponseEntity.ok(Map.of("message", "Leçon supprimée"));
    }

    @GetMapping("/{courseId}/lessons")
    @Transactional(readOnly = true)  // ← AJOUTEZ CETTE LIGNE
    public ResponseEntity<?> getCourseLessons(@PathVariable Long courseId) {
        List<Lesson> lessons = lessonRepo.findByCourseId(courseId);
        return ResponseEntity.ok(lessons);
    }

}