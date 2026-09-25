# 🎯 Guide de Préparation — Entretien Technique

> Stack ciblée : **Spring Boot · FastAPI · React · Docker · PostgreSQL · JWT · Grafana · Jenkins · SonarQube**

---

## 📌 SOMMAIRE

1. [Architecture en Couches](#1-architecture-en-couches)
2. [Communication entre Couches](#2-communication-entre-couches)
3. [Design Patterns](#3-design-patterns)
4. [Spring Boot](#4-spring-boot)
5. [FastAPI](#5-fastapi)
6. [React](#6-react)
7. [Sécurité & JWT](#7-sécurité--jwt)
8. [Docker & DevOps](#8-docker--devops)
9. [Base de Données](#9-base-de-données)
10. [Monitoring](#10-monitoring)
11. [CI/CD](#11-cicd)
12. [Questions Transversales](#12-questions-transversales)

---

## 1. Architecture en Couches

---

### Q1 : Qu'est-ce que l'architecture en couches ? Pourquoi l'utiliser ?

**R :** Pattern qui divise l'application en responsabilités distinctes et isolées.

```
┌─────────────────────────────┐
│  Couche Présentation (UI)   │  → React / API REST
├─────────────────────────────┤
│  Couche Application         │  → Controllers / REST endpoints
├─────────────────────────────┤
│  Couche Métier (Service)    │  → Logique business, règles métier
├─────────────────────────────┤
│  Couche Accès données (DAO) │  → Repository, JPA, SQL
├─────────────────────────────┤
│  Base de Données            │  → PostgreSQL
└─────────────────────────────┘
```

**Avantages :**
- **Séparation des responsabilités** (SoC)
- **Testabilité** : chaque couche testable indépendamment
- **Maintenabilité** : modifier une couche sans toucher les autres
- **Réutilisabilité** du code

---

### Q2 : Quelle est la différence entre Controller, Service et Repository ?

**R :**

| Couche       | Rôle                              | Annotation Spring     |
|--------------|-----------------------------------|-----------------------|
| `Controller` | Reçoit les requêtes HTTP          | `@RestController`     |
| `Service`    | Contient la logique métier        | `@Service`            |
| `Repository` | Accède à la base de données       | `@Repository`         |

**Flux :**
```
HTTP Request → Controller → Service → Repository → DB
                         ←         ←            ←
```

---

### Q3 : Que signifie "Couplage faible" (loose coupling) ?

**R :** Chaque couche ne connaît que l'interface de la couche voisine, pas son implémentation.

```java
// ✅ Bon : le Controller dépend de l'interface, pas de la classe concrète
@Autowired
private UserService userService; // interface

// Spring injecte automatiquement la bonne implémentation
```

---

## 2. Communication entre Couches

---

### Q4 : Comment les couches communiquent-elles dans Spring Boot ?

**R :** Via **injection de dépendances (DI)** gérée par le conteneur IoC de Spring.

```java
// Couche Controller → appelle Service
@RestController
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService; // injecté par Spring
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserDTO> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }
}

// Couche Service → appelle Repository
@Service
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;

    public UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserDTO findById(Long id) {
        User user = userRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return mapToDTO(user);
    }
}
```

---

### Q5 : Qu'est-ce qu'un DTO ? Pourquoi l'utiliser ?

**R :** **Data Transfer Object** — objet qui transporte les données entre couches sans exposer l'entité.

```
Entity (DB) → Service → DTO → Controller → JSON (HTTP Response)
```

**Pourquoi ?**
- Éviter d'exposer des champs sensibles (mot de passe)
- Séparer le modèle DB du modèle API
- Contrôler exactement ce qui est sérialisé

```java
// Entité DB
@Entity
public class User {
    private Long id;
    private String username;
    private String passwordHash; // ❌ ne doit PAS partir dans l'API
}

// DTO (ce qu'on expose)
public class UserDTO {
    private Long id;
    private String username; // ✅ seulement ce dont le client a besoin
}
```

---

### Q6 : Comment Frontend (React) et Backend (Spring) communiquent-ils ?

**R :** Via **API REST** avec le protocole **HTTP/HTTPS**.

```
React (Frontend)
    │  HTTP Request (GET /api/users)
    │  Headers: { Authorization: "Bearer JWT_TOKEN" }
    ▼
Spring Boot (Backend)
    │  vérifie JWT → traite → répond
    ▼
HTTP Response: { status: 200, body: [...] }
    │
    ▼
React affiche les données
```

**Formats :** JSON (principalement), headers HTTP, status codes.

---

### Q7 : Comment Spring Boot et FastAPI communiquent-ils ?

**R :** Via des appels **HTTP internes** (microservices).

```
Spring Boot  ──HTTP POST──▶  FastAPI /analyze
(Java/REST)                  (Python/ML)
                 ◀──JSON──   { "score": 0.87, "errors": [...] }
```

```java
// Spring Boot appelle FastAPI pour l'analyse de prononciation
RestTemplate restTemplate = new RestTemplate();
String fastApiUrl = "http://fastapi:8000/analyze";
AnalysisResult result = restTemplate.postForObject(fastApiUrl, audioData, AnalysisResult.class);
```

---

### Q8 : Qu'est-ce que l'Inversion of Control (IoC) et l'injection de dépendances ?

**R :**
- **IoC** : Spring crée et gère les objets, pas le développeur
- **DI** : les dépendances sont "injectées" dans les classes

```java
// ❌ Sans DI : couplage fort
public class UserService {
    private UserRepository repo = new UserRepositoryImpl(); // création manuelle
}

// ✅ Avec DI : couplage faible
@Service
public class UserService {
    private final UserRepository repo; // Spring injecte l'implémentation
    public UserService(UserRepository repo) { this.repo = repo; }
}
```

---

## 3. Design Patterns

---

### Q9 : Quels design patterns avez-vous utilisés ?

**R :**

| Pattern           | Où utilisé                         | Description                             |
|-------------------|------------------------------------|-----------------------------------------|
| **MVC**           | Spring Boot (Controller/Service)   | Sépare Modèle, Vue, Contrôleur          |
| **Repository**    | Spring Data JPA                    | Abstraction de l'accès aux données      |
| **Singleton**     | Beans Spring (@Service, @Repo)     | Une seule instance par bean             |
| **Factory**       | `EntityManagerFactory`, `BeanFactory` | Crée des objets sans exposer la logique |
| **Builder**       | Lombok `@Builder`, DTOs            | Construction d'objets complexes         |
| **Strategy**      | Différents algorithmes d'analyse   | Interchangeable à l'exécution           |
| **Observer**      | Events Spring, WebSocket           | Notifier des changements               |
| **Chain of Resp.**| Filtres Spring Security (JWT)      | Chaîne de filtres HTTP                  |
| **DTO**           | Transfert entre couches            | Isolation entité/API                    |

---

### Q10 : Expliquez le pattern MVC.

**R :**

```
Utilisateur clique "Submit"
        │
        ▼
   Controller  ←── reçoit la requête HTTP, décide quoi faire
        │
        ▼
    Service / Model  ←── logique métier + accès données
        │
        ▼
    View (Response)  ←── renvoie JSON ou HTML
```

- **M**odel = données + logique métier
- **V**iew = ce que voit l'utilisateur (JSON dans une API REST)
- **C**ontroller = orchestrateur, point d'entrée

---

### Q11 : Qu'est-ce que le pattern Repository ?

**R :** Abstraction de l'accès aux données. Le Service ignore comment les données sont stockées.

```java
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    // Spring génère l'implémentation SQL automatiquement !
}
```

**Avantages :**
- Changer PostgreSQL → MongoDB sans modifier le Service
- Tests faciles avec des mocks

---

### Q12 : Qu'est-ce que le pattern Singleton ? Comment Spring l'implémente ?

**R :** Une seule instance d'un objet dans toute l'application.

```java
@Service  // → Singleton par défaut dans Spring
public class UserService { ... }
// Spring crée UNE SEULE instance et l'injecte partout
```

**Scopes Spring :**
- `singleton` — une instance (défaut)
- `prototype` — nouvelle instance à chaque injection
- `request` — une instance par requête HTTP

---

### Q13 : Qu'est-ce que le pattern Builder ?

**R :** Construire des objets complexes étape par étape.

```java
// Avec Lombok @Builder
User user = User.builder()
    .name("Alice")
    .email("alice@example.com")
    .role(Role.STUDENT)
    .build();
```

---

### Q14 : Qu'est-ce que le pattern Strategy ?

**R :** Famille d'algorithmes interchangeables à l'exécution.

```java
// Interface commune
public interface PronunciationAnalyzer {
    AnalysisResult analyze(AudioData audio);
}

// Implémentations différentes
public class DeepSpeechAnalyzer implements PronunciationAnalyzer { ... }
public class WhisperAnalyzer implements PronunciationAnalyzer { ... }

// Context : choisir la stratégie à l'exécution
@Service
public class AnalysisService {
    private PronunciationAnalyzer analyzer;

    public void setAnalyzer(PronunciationAnalyzer analyzer) {
        this.analyzer = analyzer;
    }
}
```

---

## 4. Spring Boot

---

### Q15 : Qu'est-ce que Spring Boot ? Différence avec Spring ?

**R :**
- **Spring Framework** = framework complet, configuration manuelle (XML)
- **Spring Boot** = Spring + auto-configuration + serveur embarqué + starters

```
Spring Boot = Spring + Convention over Configuration
```

**Avantages :** démarrage rapide, pas de XML, Tomcat embarqué, starters prêts à l'emploi.

---

### Q16 : Cycle de vie d'une requête HTTP dans Spring Boot ?

**R :**

```
HTTP Request
    ▼
DispatcherServlet  (point d'entrée unique)
    ▼
Filter Chain (Spring Security → vérifie JWT)
    ▼
HandlerMapping  (trouve le bon Controller)
    ▼
@RestController / @RequestMapping
    ▼
@Service  (logique métier)
    ▼
@Repository / JPA  (accès DB)
    ▼
HTTP Response (JSON)
```

---

### Q17 : Qu'est-ce que JPA et Hibernate ?

**R :**
- **JPA** = spécification standard Java pour l'ORM
- **Hibernate** = implémentation de JPA (la plus populaire)
- **Spring Data JPA** = surcouche qui simplifie encore plus

```java
@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Session> sessions;
}
```

**ORM** = Object Relational Mapping → Java objects ↔ tables SQL automatiquement.

---

### Q18 : `@Transactional` — C'est quoi ?

**R :** Garantit que plusieurs opérations DB s'exécutent en bloc atomique (tout réussit ou tout échoue).

```java
@Transactional
public void transferScore(Long fromId, Long toId, int points) {
    userService.deductPoints(fromId, points);
    userService.addPoints(toId, points);
    // Si une opération échoue → rollback automatique
}
```

**ACID :** Atomicité, Cohérence, Isolation, Durabilité.

---

### Q19 : `@RestController` vs `@Controller` ?

**R :**
- `@Controller` → retourne une **vue** (HTML template)
- `@RestController` = `@Controller` + `@ResponseBody` → retourne du **JSON** directement

```java
@RestController  // API REST → JSON
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody CreateUserRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(req));
    }
}
```

---

## 5. FastAPI

---

### Q20 : Qu'est-ce que FastAPI ? Pourquoi pour le ML ?

**R :** Framework Python moderne et rapide pour APIs REST.

**Avantages pour le ML :**
- **Asynchrone** (async/await)
- **Typage fort** (Pydantic) → validation automatique
- **Doc auto** → `/docs` (Swagger UI) généré automatiquement
- Intégration native avec numpy, torch, librosa

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class AudioRequest(BaseModel):
    audio_base64: str
    language: str = "fr"

@app.post("/analyze")
async def analyze_pronunciation(request: AudioRequest):
    result = model.predict(request.audio_base64)
    return {"score": result.score, "errors": result.errors}
```

---

### Q21 : Qu'est-ce que Pydantic ?

**R :** Bibliothèque de validation de données. Rôle de DTO + validation dans FastAPI.

```python
from pydantic import BaseModel, validator

class UserInput(BaseModel):
    username: str
    score: float

    @validator('score')
    def score_must_be_valid(cls, v):
        if not 0 <= v <= 100:
            raise ValueError("Score doit être entre 0 et 100")
        return v
```

**Équivalent Spring :** `@Valid` + `@NotNull`, `@Min`, `@Max`.

---

### Q22 : `async def` vs `def` dans FastAPI ?

**R :**
- `async def` → non-bloquant, idéal pour I/O (DB, fichiers, HTTP)
- `def` → bloquant, FastAPI le gère dans un thread pool automatiquement

```python
@app.post("/analyze")
async def analyze(request: AudioRequest):  # I/O
    result = await model.async_predict(request.audio_base64)
    return result

@app.post("/compute")
def heavy_compute(data: InputData):  # CPU intensif
    return model.predict(data)  # thread pool automatique
```

---

## 6. React

---

### Q23 : Qu'est-ce que React ? Le Virtual DOM ?

**R :** Bibliothèque JavaScript pour créer des UIs réactives par composants.

```
State change → React crée un Virtual DOM (copie légère)
             → Compare avec le précédent (Diffing)
             → Met à jour UNIQUEMENT les nœuds changés dans le vrai DOM
             → Performance optimisée
```

---

### Q24 : Les hooks React essentiels ?

**R :**

| Hook          | Rôle                                   | Exemple                                   |
|---------------|----------------------------------------|-------------------------------------------|
| `useState`    | État local du composant                | `const [score, setScore] = useState(0)`   |
| `useEffect`   | Effets de bord (fetch, timers)         | Appel API au montage                      |
| `useContext`  | Contexte global sans prop drilling     | `AuthContext`, `ThemeContext`              |
| `useCallback` | Mémoïse une fonction                   | Éviter re-render inutile                  |
| `useMemo`     | Mémoïse une valeur calculée            | Calculs coûteux                           |
| `useRef`      | Référence vers un élément DOM          | Focus, player audio                       |

```jsx
const [sessions, setSessions] = useState([]);

useEffect(() => {
    const token = localStorage.getItem("jwt");
    fetch("/api/sessions", {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setSessions(data));
}, []); // [] = exécuté une seule fois au montage
```

---

### Q25 : "Prop drilling" — c'est quoi et comment l'éviter ?

**R :** Passer des props de parent en parent sur plusieurs niveaux.

```
App → Layout → Page → Section → Component → data  ❌ prop drilling
```

**Solutions :**
- `useContext` + `createContext` (natif React)
- Redux / Zustand (state management global)
- React Query (données serveur)

---

## 7. Sécurité & JWT

---

### Q26 : Qu'est-ce que JWT ? Structure ?

**R :** **JSON Web Token** — token compact et signé pour authentification stateless.

```
eyJhbGc... . eyJ1c2Vy... . SflKxwRJS...
   │               │              │
 Header          Payload       Signature
(algorithme)  (données user)  (vérification)
```

**Flux complet :**
```
Login (email + password)
    → Spring vérifie credentials
    → Génère JWT signé avec clé secrète
    → Renvoie token au client

Requête suivante :
    → Client envoie: Authorization: Bearer <token>
    → Spring filtre JWT → décode → vérifie signature
    → Autorise ou refuse
```

---

### Q27 : JWT vs Session Cookie ?

**R :**

| Critère        | JWT (Stateless)              | Session Cookie (Stateful)         |
|----------------|------------------------------|-----------------------------------|
| Stockage       | Côté client (localStorage)   | Côté serveur (mémoire/DB)         |
| Scalabilité    | ✅ Excellent (microservices) | ❌ Partage de session problématique |
| Révocation     | ❌ Difficile (blacklist)     | ✅ Simple (supprimer session)     |
| Taille         | Plus grand                   | Petit (juste un ID)               |

---

### Q28 : Comment Spring Security gère le JWT ?

**R :** Via une chaîne de filtres (**Chain of Responsibility** pattern) :

```
HTTP Request
    ▼
JwtAuthenticationFilter (custom)
    → extrait token du header
    → vérifie signature + expiration
    → charge UserDetails depuis DB
    → crée SecurityContext
    ▼
SecurityConfig (accès autorisé ou non)
    ▼
Controller
```

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, ...) {
        String token = extractToken(req);
        if (jwtService.isValid(token)) {
            UserDetails user = userDetailsService.loadUserByUsername(
                jwtService.extractUsername(token));
            SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(
                    user, null, user.getAuthorities()));
        }
        filterChain.doFilter(req, response);
    }
}
```

---

### Q29 : Qu'est-ce que CORS ?

**R :** **Cross-Origin Resource Sharing** — politique navigateur qui bloque les requêtes cross-domain.

```
React (localhost:3000) → Spring Boot (localhost:8080)
    ❌ Bloqué par défaut (origines différentes)
```

```java
@Configuration
public class CorsConfig {
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:3000"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        // ...
    }
}
```

---

## 8. Docker & DevOps

---

### Q30 : Docker — conteneur vs VM ?

**R :**

```
VM                          Conteneur Docker
┌─────────────────┐        ┌─────────────────┐
│   Application   │        │   Application   │
│   OS Guest      │        │   Libs          │
│   Hyperviseur   │        │   Docker Engine │
│   OS Host       │        │   OS Host       │
└─────────────────┘        └─────────────────┘
VM : OS complet → lourd    Conteneur : partage noyau → léger, rapide
```

---

### Q31 : Docker Compose — c'est quoi ?

**R :** Orchestration multi-conteneurs avec un seul fichier YAML.

```yaml
services:
  spring-backend:
    build: ./backend_spring
    ports: ["8080:8080"]
    depends_on: [postgres]

  fastapi:
    build: ./fastapi
    ports: ["8000:8000"]

  frontend:
    build: ./frontend
    ports: ["3000:80"]

  postgres:
    image: postgres:15
    volumes: [pgdata:/var/lib/postgresql/data]

  grafana:
    image: grafana/grafana
    ports: ["3001:3000"]
```

**Commandes :** `docker-compose up -d`, `docker-compose down`, `docker-compose logs -f`

---

### Q32 : Dockerfile multi-stage pour Spring Boot ?

**R :**
```dockerfile
# Stage 1 : Build
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

# Stage 2 : Run (image légère)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## 9. Base de Données

---

### Q33 : SQL vs NoSQL ?

**R :**

| Critère        | SQL (PostgreSQL)           | NoSQL (MongoDB)             |
|----------------|----------------------------|-----------------------------|
| Structure      | Tables, schéma fixe        | Documents, schéma flexible  |
| Relations      | JOINs, clés étrangères     | Documents imbriqués         |
| Transactions   | ACID natif                 | BASE (Eventually consistent)|
| Cas d'usage    | Données structurées        | Données non-structurées     |

---

### Q34 : Qu'est-ce qu'un index ?

**R :** Structure qui accélère les recherches (comme un index de livre).

```sql
-- Sans index : scan complet O(n)
SELECT * FROM users WHERE email = 'alice@test.com';

-- Avec index : recherche O(log n)
CREATE INDEX idx_users_email ON users(email);
```

**Inconvénient :** ralentit INSERT/UPDATE.

---

### Q35 : Migration de base de données ?

**R :** Versionnage des changements de schéma SQL (Flyway / Liquibase).

```sql
-- V1__create_users.sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- V2__add_score.sql
ALTER TABLE users ADD COLUMN total_score INTEGER DEFAULT 0;
```

Spring Boot + Flyway applique les migrations au démarrage.

---

## 10. Monitoring

---

### Q36 : Prometheus + Grafana — comment ça marche ?

**R :**

```
Spring Boot → expose /actuator/prometheus (métriques)
                    ▼
              Prometheus (collecte & stocke)
                    ▼
               Grafana (visualise avec dashboards)
                    ▼
              Alertmanager (alertes si seuils dépassés)
```

- **Prometheus** = base de données time-series
- **Grafana** = visualisation et dashboards
- **Actuator** = module Spring Boot qui expose les métriques

---

### Q37 : Quelles métriques monitorez-vous ?

**R :**
- **Système** : CPU, RAM, Disk
- **JVM** : heap memory, GC, threads
- **Applicatives** : req/sec, latence, erreurs 5xx
- **Métier** : nombre d'analyses, scores moyens

---

## 11. CI/CD

---

### Q38 : Pipeline Jenkins — les étapes ?

**R :**

```
Git Push
    ▼
Checkout → Build (mvn package) → Test → SonarQube → Docker Build → Deploy
```

---

### Q39 : SonarQube — c'est quoi ?

**R :** Analyse statique de code → détecte problèmes de qualité.

**Métriques :** Bugs, Vulnérabilités, Code Smells, Coverage, Duplications, Dette technique.

**Quality Gate** = seuil minimum pour passer le pipeline (ex: coverage > 80%).

---

## 12. Questions Transversales

---

### Q40 : API RESTful — les contraintes ?

**R :**

1. **Client-Server** : séparation UI / serveur
2. **Stateless** : chaque requête est indépendante
3. **Cacheable** : réponses peuvent être cachées
4. **Uniform Interface** : URLs cohérentes, HTTP verbs standard
5. **Layered System** : architecture en couches transparente

**HTTP Verbs :**
```
GET    /users      → lister
GET    /users/{id} → détail
POST   /users      → créer
PUT    /users/{id} → remplacer
PATCH  /users/{id} → modifier partiellement
DELETE /users/{id} → supprimer
```

---

### Q41 : Principes SOLID ?

**R :**

| Lettre | Principe                 | Résumé                                    |
|--------|--------------------------|-------------------------------------------|
| **S**  | Single Responsibility    | Une classe = une responsabilité           |
| **O**  | Open/Closed              | Ouvert à l'extension, fermé à la modif    |
| **L**  | Liskov Substitution      | Sous-classes substituables au parent      |
| **I**  | Interface Segregation    | Interfaces spécifiques plutôt que larges  |
| **D**  | Dependency Inversion     | Dépendre des abstractions, pas des implem |

**Dans votre code :**
- **S** : `UserController` gère HTTP, `UserService` gère logique métier
- **D** : Service dépend de `UserRepository` (interface), pas de l'implémentation

---

### Q42 : Comment gérez-vous les erreurs ?

**R :** Via **`@ControllerAdvice`** (gestion globale des exceptions).

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(404)
            .body(new ErrorResponse(404, ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        return ResponseEntity.status(500)
            .body(new ErrorResponse(500, "Erreur interne"));
    }
}
```

---

### Q43 : `@Bean` vs `@Component` vs `@Service` vs `@Repository` ?

**R :**

| Annotation    | Usage                                    |
|---------------|------------------------------------------|
| `@Component`  | Générique, tout composant Spring          |
| `@Service`    | Couche service (logique métier)          |
| `@Repository` | Couche données + gestion exceptions JPA  |
| `@Controller` | Couche présentation HTTP                 |
| `@Bean`       | Méthode dans `@Configuration` → bean externe |

```java
@Configuration
public class AppConfig {
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate(); // classe externe, pas annotable
    }
}
```

---

### Q44 : Test unitaire vs intégration ?

**R :**

| Type             | Quoi                        | Outils                       |
|------------------|-----------------------------|------------------------------|
| **Unitaire**     | Classe isolée (mock deps)   | JUnit 5 + Mockito            |
| **Intégration**  | Plusieurs couches ensemble  | `@SpringBootTest`            |
| **API/E2E**      | Requête HTTP → réponse      | MockMvc, RestAssured         |

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock private UserRepository userRepository;
    @InjectMocks private UserServiceImpl userService;

    @Test
    void findById_shouldReturnUser() {
        when(userRepository.findById(1L))
            .thenReturn(Optional.of(new User(1L, "Alice")));
        UserDTO result = userService.findById(1L);
        assertThat(result.getName()).isEqualTo("Alice");
    }
}
```

---

### Q45 : Principe DRY ?

**R :** **Don't Repeat Yourself** — éviter la duplication.

- `BaseEntity` avec `id`, `createdAt`, `updatedAt` étendu par toutes les entités
- `@ControllerAdvice` global pour la gestion d'erreurs
- Services réutilisables (`JwtService`, `EmailService`)

---

### Q46 : Pourquoi séparer Spring Boot et FastAPI ?

**R :**

| Responsabilité       | Spring Boot (Java)    | FastAPI (Python)       |
|----------------------|-----------------------|------------------------|
| Gestion utilisateurs | ✅                    |                        |
| Auth JWT             | ✅                    |                        |
| Logique métier       | ✅                    |                        |
| ML / Analyse audio   |                       | ✅ (PyTorch, librosa)  |
| Modèles IA           |                       | ✅                     |

**Raison :** Java pour l'entreprise, Python pour l'IA → forces de chaque langage.

---

### Q47 : Monolithe vs Microservices ?

**R :**

```
Monolithe                    Microservices
┌─────────────────┐         ┌────────┐  ┌────────┐  ┌────────┐
│  UI + Auth +    │         │  UI    │  │ Auth   │  │  ML    │
│  Business +     │   →     │ Service│  │ Service│  │ Service│
│  Data Access    │         └────────┘  └────────┘  └────────┘
└─────────────────┘
```

**Votre projet :** architecture hybride — Spring Boot + FastAPI = 2 services spécialisés.

---

### Q48 : Versioning d'API ?

**R :**
```
/api/v1/users  → Version 1 (stable)
/api/v2/users  → Version 2 (nouvelles features)
```

**Stratégies :** URL versioning (le + courant), Header, Query param.

---

## 🎓 Schéma Global de l'Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                       │
│              SPA - Axios - JWT dans localStorage             │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP/HTTPS REST (JSON)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                 SPRING BOOT BACKEND (Java)                    │
│ SecurityFilter → Controller → Service → Repository → PgSQL  │
│                 ↕ RestTemplate HTTP ↕                        │
│            FASTAPI BACKEND (Python)                          │
│       /analyze → ML Model → Audio Processing → Score         │
└──────────────────────────┬───────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     PostgreSQL       Prometheus        Jenkins
     (Données)        + Grafana         CI/CD
                      (Monitoring)    SonarQube
```

---

*📅 Préparé le 28 juillet 2026 — Bon courage pour la soutenance !* 🚀
