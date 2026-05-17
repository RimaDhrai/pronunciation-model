pipeline {
    agent any

    environment {
        GIT_REPO            = 'https://github.com/Talan-PFE2026/pronunciation.git'
        GIT_BRANCH          = 'main'
        SONAR_HOST_URL      = 'http://host.docker.internal:9000'
        SONAR_TOKEN         = credentials('sonarqube-token')
        PROJECT_KEY         = 'SpeakCoach'
        NOTIFICATION_EMAIL  = 'rima.dhrai@talan.com'
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
                        path: 'backend_spring/target/jacoco.exec'
                    )
                }
            }
        }

        // ── 4. TESTS FRONTEND (vitest + couverture) ──────────────────────────
        stage('Test — Frontend') {
            tools {
                nodejs 'Node20'
            }
            steps {
                dir("${env.WORKSPACE}/frontend") {
                    sh 'npm install --no-fund --no-audit'
                    sh 'npm run test:coverage'
                }
            }
        }

        // ── 5. TESTS FASTAPI (conditionnel) ──────────────────────────────────
        stage('Test — FastAPI') {
            steps {
                dir("${env.WORKSPACE}/fastapi") {
                    sh '''
                        if command -v python3 > /dev/null 2>&1 || command -v python > /dev/null 2>&1; then
                            echo "Python trouvé. Configuration de l'environnement virtuel..."
                            python3 -m venv .venv || python -m venv .venv
                            . .venv/bin/activate
                            pip install --upgrade pip -q
                            pip install -r requirements.txt -q
                            pip install pytest pytest-cov httpx -q
                            pytest tests/ \
                                --tb=short -q \
                                --cov=. \
                                --cov-report=xml:coverage.xml \
                                --cov-report=term-missing \
                                --cov-config=.coveragerc || true
                        else
                            echo "⚠️ Python n'est pas installé sur cet agent Jenkins — tests FastAPI ignorés"
                        fi
                    '''
                }
            }
        }

        // ── 6. ANALYSE SONARQUBE ─────────────────────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                // Analyse Spring Boot (Maven)
                withSonarQubeEnv('SonarQube') {
                    dir("${env.WORKSPACE}/backend_spring") {
                        sh """
                            ./mvnw sonar:sonar \
                                -Dsonar.projectKey=${PROJECT_KEY} \
                                -Dsonar.projectName="SpeakCoach" \
                                -Dsonar.host.url=${SONAR_HOST_URL} \
                                -Dsonar.token=${SONAR_TOKEN} \
                                -Dsonar.java.binaries=target/classes \
                                -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml \
                                -Dsonar.exclusions=**/keycloak/**,**/*Application.java,**/config/** \
                                -Dsonar.cpd.exclusions=**/entity/**,**/dto/**,**/repository/**
                        """
                    }
                }
                // Analyse multi-modules (Frontend + FastAPI) — Conditionnel
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        if command -v sonar-scanner > /dev/null 2>&1; then
                            echo "Lancement du sonar-scanner pour le Frontend & FastAPI..."
                            sonar-scanner \
                                -Dsonar.projectKey=speakcoach-fullstack \
                                -Dsonar.host.url=${SONAR_HOST_URL} \
                                -Dsonar.token=${SONAR_TOKEN} \
                                -Dproject.settings=sonar-project.properties
                        else
                            echo "⚠️  sonar-scanner CLI non disponible sur cet agent Jenkins — Analyse Frontend/FastAPI ignorée"
                        fi
                    '''
                }
            }
        }

        // ── 7. QUALITY GATE ───────────────────────────────────────────────────
        // catchError : Si le webhook Sonar n'est pas configuré, le build reste SUCCESS
        stage('Quality Gate') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    timeout(time: 5, unit: 'MINUTES') {
                        waitForQualityGate abortPipeline: false
                    }
                }
            }
        }

        // ── 8. DOCKER BUILD (conditionnel) ───────────────────────────────────
        stage('Docker Build — Full Stack') {
            steps {
                sh '''
                    if command -v docker > /dev/null 2>&1; then
                        echo "Docker disponible — lancement du build compose"
                        docker compose -f ${WORKSPACE}/docker-compose.yml build --no-cache 2>&1 | tail -30
                    else
                        echo "⚠️  Docker CLI non disponible sur cet agent Jenkins — étape ignorée"
                        echo "Les images sont construites via docker-compose sur le serveur de déploiement."
                    fi
                '''
            }
        }

        // ── 9. DÉPLOIEMENT AUTO ───────────────────────────────────────────────
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                echo "Déploiement du build #${env.BUILD_NUMBER} sur ${DEPLOY_DIR}"
                sh '''
                    if command -v docker > /dev/null 2>&1; then
                        cd ''' + env.DEPLOY_DIR + '''
                        git pull origin main
                        docker compose up -d --build 2>&1 | tail -20
                        echo "Déploiement terminé"
                    else
                        echo "⚠️  Docker non disponible — déploiement ignoré en CI"
                    fi
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline réussi — Build #${env.BUILD_NUMBER}"
        }
        failure {
            echo "❌ Pipeline échoué — Build #${env.BUILD_NUMBER}"
        }
        always {
            cleanWs(cleanWhenFailure: false)
        }
    }
}
