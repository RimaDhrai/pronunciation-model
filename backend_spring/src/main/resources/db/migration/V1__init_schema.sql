-- ═══════════════════════════════════════════════════════════════
-- V1 — Schéma initial SpeakCoach
-- Généré depuis les entités JPA (Java 21 / Spring Boot 3.3)
-- ═══════════════════════════════════════════════════════════════

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                BIGSERIAL PRIMARY KEY,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    full_name         VARCHAR(255),
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ,
    cefr_level        VARCHAR(5),
    cefr_level_en     VARCHAR(5),
    cefr_completed    BOOLEAN DEFAULT FALSE,
    cefr_completed_en BOOLEAN DEFAULT FALSE,
    job_title         VARCHAR(100),
    native_lang       VARCHAR(10) DEFAULT 'fr',
    total_xp          INTEGER DEFAULT 0,
    current_streak    INTEGER DEFAULT 0,
    longest_streak    INTEGER DEFAULT 0,
    last_activity_date DATE,
    weak_words        VARCHAR(500)
);

-- ── Courses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
    id               BIGSERIAL PRIMARY KEY,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    cefr_level       VARCHAR(5) NOT NULL,
    lang             VARCHAR(5),
    category         VARCHAR(50),
    duration_minutes INTEGER,
    thumbnail_url    TEXT,
    display_order    INTEGER DEFAULT 0,
    active           BOOLEAN DEFAULT TRUE
);

-- ── Lessons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
    id           BIGSERIAL PRIMARY KEY,
    course_id    BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    content      TEXT,
    video_url    TEXT,
    order_index  INTEGER DEFAULT 0,
    duration_min INTEGER
);

-- ── User Course Progress ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_course_progress (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id    BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    progress_pct INTEGER DEFAULT 0,
    enrolled_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE (user_id, course_id)
);

-- ── Lesson Progress ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_progress (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id    BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed    BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    UNIQUE (user_id, lesson_id)
);

-- ── Attempts (exercices de prononciation) ─────────────────────
CREATE TABLE IF NOT EXISTS attempts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expected_phrase VARCHAR(500) NOT NULL,
    transcription   VARCHAR(500),
    score           INTEGER NOT NULL,
    wer             DOUBLE PRECISION,
    language        VARCHAR(10),
    level           VARCHAR(5),
    feedback        TEXT,
    audio_path      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL
);

-- ── Phrase Attempts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phrase_attempts (
    id          BIGSERIAL PRIMARY KEY,
    attempt_id  BIGINT REFERENCES attempts(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
    phrase      VARCHAR(500),
    score       INTEGER,
    wer         DOUBLE PRECISION,
    created_at  TIMESTAMP
);

-- ── Exercise Progress ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_progress (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL,
    level          VARCHAR(5) NOT NULL,
    lang           VARCHAR(2) NOT NULL DEFAULT 'fr',
    done           BOOLEAN NOT NULL DEFAULT FALSE,
    mastered       BOOLEAN NOT NULL DEFAULT FALSE,
    last_avg_score INTEGER,
    completed      INTEGER NOT NULL DEFAULT 0,
    sessions_count INTEGER NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP,
    UNIQUE (user_id, level, lang)
);

-- ── CEFR Sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cefr_sessions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lang         VARCHAR(5) DEFAULT 'fr',
    level        VARCHAR(5),
    score        INTEGER DEFAULT 0,
    step         INTEGER DEFAULT 0,
    lives        INTEGER DEFAULT 3,
    completed    BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP,
    completed_at TIMESTAMP
);

-- ── User Sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    ended_at   TIMESTAMPTZ,
    mode       VARCHAR(50)
);

-- ── Master Sessions (LangGraph4J) ─────────────────────────────
CREATE TABLE IF NOT EXISTS master_sessions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) UNIQUE,
    mode       VARCHAR(50) DEFAULT 'CHAT',
    state      TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- ── Spaced Repetition ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaced_repetition_items (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phrase       VARCHAR(500),
    lang         VARCHAR(5) DEFAULT 'fr',
    ease_factor  DOUBLE PRECISION DEFAULT 2.5,
    interval     INTEGER DEFAULT 1,
    repetitions  INTEGER DEFAULT 0,
    next_review  DATE,
    last_score   INTEGER,
    created_at   TIMESTAMP
);

-- ── Badges ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100),
    description VARCHAR(255),
    icon_url    VARCHAR(255),
    awarded_at  TIMESTAMPTZ
);

-- ── Password Reset Tokens ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         BIGSERIAL PRIMARY KEY,
    token      VARCHAR(255) NOT NULL UNIQUE,
    email      VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used       BOOLEAN DEFAULT FALSE
);

-- ── Mail Settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mail_settings (
    id          BIGSERIAL PRIMARY KEY,
    smtp_host   VARCHAR(255),
    smtp_port   INTEGER DEFAULT 587,
    username    VARCHAR(255),
    password    VARCHAR(255),
    enabled     BOOLEAN DEFAULT FALSE,
    updated_at  TIMESTAMP
);

-- ── Planner Step Results ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS planner_step_results (
    id         BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100),
    step_name  VARCHAR(100),
    result     TEXT,
    created_at TIMESTAMP
);

-- ── Index utiles ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attempts_user_id      ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at   ON attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_exercise_progress_uid ON exercise_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_spaced_rep_review     ON spaced_repetition_items(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_cefr_sessions_uid     ON cefr_sessions(user_id);
