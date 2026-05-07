package com.example.prononciationtest.controller;

import com.example.prononciationtest.entity.SpacedRepetitionItem;
import com.example.prononciationtest.entity.User;
import com.example.prononciationtest.repository.SpacedRepetitionRepository;
import com.example.prononciationtest.repository.UserRepository;
import com.example.prononciationtest.service.SessionMemoryService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.LocalDate;
import java.util.*;
import java.util.LinkedHashMap;

@RestController
@RequestMapping("/api/spaced-repetition")
@CrossOrigin(origins = "http://localhost:8081")
@RequiredArgsConstructor
public class SpacedRepetitionController {

    private static final int[] INTERVALS = {1, 3, 7, 14, 30};

    private final SpacedRepetitionRepository srRepo;
    private final UserRepository userRepo;
    private final SessionMemoryService sessionMemory;

    @PostConstruct
    void migrateNullItemTypes() {
        srRepo.migrateNullItemTypes();
    }

    // POST /api/spaced-repetition/errors — record mispronounced words
    @PostMapping("/errors")
    public ResponseEntity<?> recordErrors(
            @RequestBody List<Map<String, String>> words, // [{word, level, lang}]
            @RequestParam(name = "master_session_id", required = false) String masterSessionId,
            Authentication auth) {
        User user = getUser(auth);
        List<String> recordedWords = new ArrayList<>();
        for (Map<String, String> w : words) {
            String word = w.getOrDefault("word", "").trim().toLowerCase();
            String level = w.getOrDefault("level", "A1");
            String lang = w.getOrDefault("lang", "fr");
            if (word.isBlank()) continue;
            
            SpacedRepetitionItem item = srRepo.findByUserIdAndWordIgnoreCase(user.getId(), word)
                .orElseGet(() -> {
                    SpacedRepetitionItem i = new SpacedRepetitionItem();
                    i.setUserId(user.getId());
                    i.setWord(word);
                    i.setLevel(level);
                    i.setLang(lang);
                    i.setLastSeen(LocalDate.now());
                    i.setNextReview(LocalDate.now().plusDays(1));
                    return i;
                });
            
            item.setErrorCount(item.getErrorCount() + 1);
            item.setLastSeen(LocalDate.now());
            // Ensure lang is updated if it was null
            if (item.getLang() == null) item.setLang(lang);
            
            int nextInterval = nextInterval(item.getIntervalDays());
            item.setIntervalDays(nextInterval);
            item.setNextReview(LocalDate.now().plusDays(nextInterval));
            srRepo.save(item);
            recordedWords.add(word);
        }
        // Report weak words to MasterAgent memory (fire-and-forget)
        if (masterSessionId != null && !masterSessionId.isBlank()
                && !recordedWords.isEmpty() && sessionMemory.exists(masterSessionId)) {
            sessionMemory.addWeakWords(masterSessionId, recordedWords);
        }
        return ResponseEntity.ok(Map.of("recorded", recordedWords.size()));
    }

    // GET /api/spaced-repetition/due — all items due for review today (words + sounds)
    @GetMapping("/due")
    public ResponseEntity<?> getDue(Authentication auth) {
        User user = getUser(auth);
        List<SpacedRepetitionItem> due = srRepo.findByUserIdAndNextReviewLessThanEqual(user.getId(), LocalDate.now());
        List<Map<String, Object>> result = due.stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",         i.getId());
            m.put("word",       i.getWord());
            m.put("level",      i.getLevel());
            m.put("errorCount", i.getErrorCount());
            m.put("itemType",   i.getItemType() != null ? i.getItemType() : "WORD");
            m.put("soundLabel", i.getSoundLabel());
            m.put("lang",       i.getLang());
            return m;
        }).toList();
        return ResponseEntity.ok(Map.of("due", result, "count", result.size()));
    }

    // GET /api/spaced-repetition/sounds/due — only phonetic sounds due for review
    @GetMapping("/sounds/due")
    public ResponseEntity<?> getSoundsDue(Authentication auth) {
        User user = getUser(auth);
        List<SpacedRepetitionItem> due = srRepo.findByUserIdAndItemTypeAndNextReviewLessThanEqual(
                user.getId(), "SOUND", LocalDate.now());
        List<Map<String, Object>> result = due.stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",          i.getId());
            m.put("soundKey",    i.getWord());
            m.put("soundLabel",  i.getSoundLabel() != null ? i.getSoundLabel() : i.getWord());
            m.put("lang",        i.getLang());
            m.put("level",       i.getLevel());
            m.put("errorCount",  i.getErrorCount());
            m.put("nextReview",  i.getNextReview().toString());
            m.put("intervalDays", i.getIntervalDays());
            return m;
        }).toList();
        return ResponseEntity.ok(Map.of("sounds", result, "count", result.size()));
    }

    // GET /api/spaced-repetition/count — total count badge (words + sounds)
    @GetMapping("/count")
    public ResponseEntity<?> getCount(Authentication auth) {
        User user = getUser(auth);
        long total  = srRepo.countByUserIdAndNextReviewLessThanEqual(user.getId(), LocalDate.now());
        long sounds = srRepo.countByUserIdAndItemTypeAndNextReviewLessThanEqual(user.getId(), "SOUND", LocalDate.now());
        long words  = total - sounds; // includes rows with item_type = NULL (treated as WORD)
        return ResponseEntity.ok(Map.of("count", total, "words", words, "sounds", sounds));
    }

    // POST /api/spaced-repetition/{id}/reviewed — mark as reviewed successfully
    @PostMapping("/{id}/reviewed")
    public ResponseEntity<?> markReviewed(
            @PathVariable Long id,
            @RequestParam(name = "master_session_id", required = false) String masterSessionId,
            Authentication auth) {
        User user = getUser(auth);
        return srRepo.findById(id)
            .filter(i -> i.getUserId().equals(user.getId()))
            .map(i -> {
                int nextInterval = nextInterval(i.getIntervalDays());
                i.setIntervalDays(nextInterval);
                i.setNextReview(LocalDate.now().plusDays(nextInterval));
                i.setLastSeen(LocalDate.now());
                srRepo.save(i);
                // Remove from MasterAgent error_log — word is now mastered
                if (masterSessionId != null && !masterSessionId.isBlank()
                        && sessionMemory.exists(masterSessionId)
                        && i.getWord() != null) {
                    sessionMemory.removeWeakWord(masterSessionId, i.getWord());
                }
                return ResponseEntity.ok(Map.of("nextReview", i.getNextReview().toString()));
            }).orElse(ResponseEntity.notFound().build());
    }

    private int nextInterval(int current) {
        for (int i = 0; i < INTERVALS.length - 1; i++) {
            if (current <= INTERVALS[i]) return INTERVALS[i + 1];
        }
        return 30; // max
    }

    private User getUser(Authentication auth) {
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Accès non autorisé");
        }
        String email;
        if (auth instanceof JwtAuthenticationToken jwt) {
            email = jwt.getToken().getClaimAsString("email");
            if (email == null) email = jwt.getToken().getClaimAsString("preferred_username");
        } else { email = auth.getName(); }
        return userRepo.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
