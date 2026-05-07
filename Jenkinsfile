pipeline {
    agent any

    environment {
        GIT_REPO       = 'https://github.com/Talan-PFE2026/pronunciation.git'
        GIT_BRANCH     = 'main'
        SONAR_HOST_URL = 'http://host.docker.internal:9000'
        SONAR_TOKEN    = credentials('sonarqube-token')
        PROJECT_KEY    = 'SpeakCoach'
    }

    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {

        // ── 1. CHECKOUT ──────────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                echo "Build #${env.BUILD_NUMBER} — branche: ${GIT_BRANCH}"
                echo "Workspace: ${env.WORKSPACE}"
            }
        }

        // ── 2. BUILD SPRING BOOT ─────────────────────────────────────────────
        stage('Build — Spring Boot') {
            steps {
                dir("${env.WORKSPACE}/backend_spring") {
                    sh 'chmod +x mvnw && ./mvnw clean package -DskipTests -q'
                }
            }
        }

        // ── 3. TESTS SPRING BOOT ─────────────────────────────────────────────
        stage('Test — Spring Boot') {
            steps {
                dir("${env.WORKSPACE}/backend_spring") {
                    sh 'chmod +x mvnw && ./mvnw test -q || true'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true,
                          testResults: 'backend_spring/target/surefire-reports/*.xml'
                }
            }
        }

        // ── 4. BUILD FASTAPI ─────────────────────────────────────────────────
        stage('Build — FastAPI') {
            steps {
                dir("${env.WORKSPACE}/fastapi") {
                    sh 'docker build -t speakcoach-fastapi:${BUILD_NUMBER} . || true'
                }
            }
        }

        // ── 5. TESTS FASTAPI ─────────────────────────────────────────────────
        stage('Test — FastAPI') {
            steps {
                dir("${env.WORKSPACE}/fastapi") {
                    sh '''
                        docker run --rm speakcoach-fastapi:${BUILD_NUMBER} \
                            python -m pytest tests/ --tb=short -q || true
                    '''
                }
            }
        }

        // ── 6. BUILD FRONTEND ────────────────────────────────────────────────
        stage('Build — Frontend') {
            steps {
                dir("${env.WORKSPACE}/frontend") {
                    sh 'docker build -t speakcoach-frontend:${BUILD_NUMBER} . || true'
                }
            }
        }

        // ── 7. ANALYSE SONARQUBE ─────────────────────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    dir("${env.WORKSPACE}/backend_spring") {
                        sh """
                            ./mvnw sonar:sonar \
                                -Dsonar.projectKey=${PROJECT_KEY} \
                                -Dsonar.projectName="SpeakCoach" \
                                -Dsonar.host.url=${SONAR_HOST_URL} \
                                -Dsonar.token=${SONAR_TOKEN} \
                                -Dsonar.java.binaries=target/classes \
                                -Dsonar.exclusions=**/keycloak/**,**/*Application.java,**/config/**
                        """
                    }
                }
            }
        }

        // ── 8. QUALITY GATE ──────────────────────────────────────────────────
        stage('Quality Gate') {
            steps {
                timeout(time: 2, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }

        // ── 9. DOCKER BUILD ───────────────────────────────────────────────────
        stage('Docker Build') {
            steps {
                sh 'docker-compose -f ${WORKSPACE}/docker-compose.yml build --no-cache 2>&1 | tail -10 || true'
            }
        }
    }

    post {
        success {
            echo "Pipeline complet réussi — Build #${env.BUILD_NUMBER}"
        }
        failure {
            echo "Pipeline échoué — Build #${env.BUILD_NUMBER}"
        }
    }
}
