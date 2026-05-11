pipeline {
    agent any

    environment {
        GIT_REPO            = 'https://github.com/Talan-PFE2026/pronunciation.git'
        GIT_BRANCH          = 'main'
        SONAR_HOST_URL      = 'http://host.docker.internal:9000'
        SONAR_TOKEN         = credentials('sonarqube-token')
        PROJECT_KEY         = 'SpeakCoach'
        NOTIFICATION_EMAIL  = 'rima.dhrai@talan.com'
        // Dossier sur le serveur où le projet est déployé
        DEPLOY_DIR          = '/opt/speakcoach'
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

        // ── 3. TESTS SPRING BOOT + JACOCO ────────────────────────────────────
        stage('Test — Spring Boot') {
            steps {
                dir("${env.WORKSPACE}/backend_spring") {
                    sh 'chmod +x mvnw && ./mvnw test jacoco:report -q'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true,
                          testResults: 'backend_spring/target/surefire-reports/*.xml'
                    jacoco(
                        execPattern:            'backend_spring/target/jacoco.exec',
                        classPattern:           'backend_spring/target/classes',
                        sourcePattern:          'backend_spring/src/main/java',
                        exclusionPattern:       '**/keycloak/**,**/*Application.java,**/config/**',
                        minimumLineCoverage:    '50',
                        minimumBranchCoverage:  '40'
                    )
                }
            }
        }

        // ── 4. TESTS FRONTEND (vitest + couverture lcov) ─────────────────────
        stage('Test — Frontend') {
            steps {
                dir("${env.WORKSPACE}/frontend") {
                    sh 'npm ci --silent'
                    sh 'npm run test:coverage'
                }
            }
            post {
                always {
                    publishHTML(target: [
                        allowMissing:           true,
                        alwaysLinkToLastBuild:  true,
                        keepAll:                true,
                        reportDir:              'frontend/coverage',
                        reportFiles:            'index.html',
                        reportName:             'Frontend Coverage Report'
                    ])
                }
            }
        }

        // ── 5. BUILD FASTAPI ─────────────────────────────────────────────────
        stage('Build — FastAPI') {
            steps {
                dir("${env.WORKSPACE}/fastapi") {
                    sh "docker build -t speakcoach-fastapi:${BUILD_NUMBER} ."
                }
            }
        }

        // ── 6. TESTS FASTAPI ─────────────────────────────────────────────────
        stage('Test — FastAPI') {
            steps {
                dir("${env.WORKSPACE}/fastapi") {
                    sh """
                        docker run --rm \
                            -v \${WORKSPACE}/fastapi:/app \
                            speakcoach-fastapi:${BUILD_NUMBER} \
                            python -m pytest tests/ \
                                --tb=short -q \
                                --cov=. \
                                --cov-report=xml:coverage.xml \
                                --cov-report=term-missing
                    """
                }
            }
        }

        // ── 7. BUILD FRONTEND IMAGE ──────────────────────────────────────────
        stage('Build — Frontend Image') {
            steps {
                dir("${env.WORKSPACE}/frontend") {
                    sh "docker build -t speakcoach-frontend:${BUILD_NUMBER} ."
                }
            }
        }

        // ── 8. ANALYSE SONARQUBE ─────────────────────────────────────────────
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
                withSonarQubeEnv('SonarQube') {
                    sh """
                        sonar-scanner \
                            -Dsonar.projectKey=speakcoach-fullstack \
                            -Dsonar.host.url=${SONAR_HOST_URL} \
                            -Dsonar.token=${SONAR_TOKEN} \
                            -Dproject.settings=sonar-project.properties
                    """
                }
            }
        }

        // ── 9. QUALITY GATE ───────────────────────────────────────────────────
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ── 10. DOCKER COMPOSE BUILD ──────────────────────────────────────────
        stage('Docker Build — Full Stack') {
            steps {
                sh "docker-compose -f ${WORKSPACE}/docker-compose.yml build --no-cache 2>&1 | tail -20"
            }
        }

        // ── 11. DÉPLOIEMENT AUTO ──────────────────────────────────────────────
        stage('Deploy') {
            // Ne déploie que sur la branche main
            when {
                branch 'main'
            }
            steps {
                echo "Déploiement du build #${env.BUILD_NUMBER} sur ${DEPLOY_DIR}"
                sh """
                    cd ${DEPLOY_DIR}
                    git pull origin main
                    docker-compose up -d --build 2>&1 | tail -20
                    echo "Déploiement terminé — Build #${env.BUILD_NUMBER}"
                """
            }
        }
    }

    post {
        success {
            echo "Pipeline complet réussi — Build #${env.BUILD_NUMBER}"
            mail to:      "${NOTIFICATION_EMAIL}",
                 subject: "✅ Build #${env.BUILD_NUMBER} réussi — SpeakCoach",
                 body:    """Build #${env.BUILD_NUMBER} sur la branche ${GIT_BRANCH} a réussi.

Durée    : ${currentBuild.durationString}
Résultat : ${currentBuild.currentResult}
Lien     : ${env.BUILD_URL}
"""
        }
        failure {
            echo "Pipeline échoué — Build #${env.BUILD_NUMBER}"
            mail to:      "${NOTIFICATION_EMAIL}",
                 subject: "❌ Build #${env.BUILD_NUMBER} ÉCHOUÉ — SpeakCoach",
                 body:    """Build #${env.BUILD_NUMBER} sur la branche ${GIT_BRANCH} a échoué.

Durée    : ${currentBuild.durationString}
Résultat : ${currentBuild.currentResult}
Lien     : ${env.BUILD_URL}

Consulte les logs Jenkins pour identifier l'erreur.
"""
        }
        always {
            cleanWs(cleanWhenFailure: false)
        }
    }
}
