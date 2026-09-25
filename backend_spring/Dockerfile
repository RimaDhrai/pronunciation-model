# -- Stage 1: Build Spring Boot app with Maven -
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app

# Copy pom.xml and download dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests -B

# -- Stage 2: Runtime with JRE -
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Create storage directories
RUN mkdir -p /app/storage/audio /app/storage/videos /app/storage/images

EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=15 --start-period=60s \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

CMD ["java", "-jar", "-Dspring.profiles.active=docker", "app.jar"]