# ── Stage 1: Build with Maven ─────────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /app

# Cache dependencies first
COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Run with lightweight JRE ─────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S speakcoach && adduser -S speakcoach -G speakcoach

COPY --from=builder /app/target/*.jar app.jar

# Storage directories (audio, videos, images)
RUN mkdir -p storage/audio storage/videos storage/images \
    && chown -R speakcoach:speakcoach /app

USER speakcoach

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=docker", "app.jar"]
