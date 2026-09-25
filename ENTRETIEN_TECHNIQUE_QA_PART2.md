# 🎯 Guide Entretien Technique — Partie 2

> **POO · IA/ML · Questions Générales** — avec des exemples concrets de votre projet **SpeakCoach**

---

## 📌 SOMMAIRE

1. [Programmation Orientée Objet (POO)](#1-programmation-orientée-objet-poo)
2. [Les 4 Piliers de la POO dans votre projet](#2-les-4-piliers-dans-votre-projet)
3. [POO Avancée (Abstractions, Interfaces, Composition)](#3-poo-avancée)
4. [Intelligence Artificielle dans le projet](#4-intelligence-artificielle)
5. [Whisper & Traitement Audio (ML)](#5-whisper--traitement-audio)
6. [LLM / Ollama / Azure OpenAI](#6-llm--ollama--azure-openai)
7. [Agent IA & Architecture Agentique](#7-agent-ia--architecture-agentique)
8. [Questions Générales Techniques](#8-questions-générales)

---

## 1. Programmation Orientée Objet (POO)

---

### Q1 : Quels sont les 4 piliers de la POO ?

**R :**

| Pilier             | Définition                                         | Mot-clé Java       |
|--------------------|------------------------------------------------------|---------------------|
| **Encapsulation**  | Cacher les données internes, exposer via méthodes    | `private`, getters/setters |
| **Héritage**       | Réutiliser le code d'une classe parent               | `extends`           |
| **Polymorphisme**  | Même méthode, comportements différents               | `@Override`, interfaces |
| **Abstraction**    | Cacher la complexité, ne montrer que l'essentiel     | `abstract`, `interface` |

---

### Q2 : Qu'est-ce que l'encapsulation ? Exemple dans votre projet ?

**R :** Protéger les données internes et contrôler l'accès via des méthodes publiques.

```java
// Dans votre entité User.java — ENCAPSULATION
@Entity
@Table(name = "users")
@Getter @Setter  // Lombok génère getters/setters → accès contrôlé
public class User {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;                    // ❌ accès direct impossible

    @Column(unique = true, nullable = false)
    private String email;               // ✅ accessible via getEmail() / setEmail()

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;        // 🔒 jamais exposé dans l'API (pas dans le DTO)

    private Integer totalXp = 0;        // ✅ modifié uniquement via GamificationService
    private Integer currentStreak = 0;
}
```

**Pourquoi c'est important :**
- `passwordHash` est `private` → jamais sérialisé en JSON grâce au DTO
- `totalXp` est modifié uniquement via `GamificationService.recordActivity()` → contrôle de la logique métier
- On ne fait **pas** `user.totalXp = 100;` directement → on passe par le service

---

### Q3 : Qu'est-ce que l'héritage ? Exemple ?

**R :** Une classe enfant hérite des attributs et méthodes de la classe parent.

```java
// Exemple conceptuel dans votre projet :

// Classe parent (abstraite)
public abstract class BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Instant createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }
}

// Les classes enfant héritent de BaseEntity
@Entity
public class User extends BaseEntity { ... }

@Entity
public class Course extends BaseEntity { ... }

@Entity
public class Attempt extends BaseEntity { ... }
```

**Avantages :** pas de duplication `id` + `createdAt` dans chaque entité.

**Types d'héritage en Java :**
- `extends` → héritage de classe (simple héritage en Java)
- `implements` → implémentation d'interface (héritage multiple d'interfaces)

---

### Q4 : Qu'est-ce que le polymorphisme ? Exemple concret ?

**R :** Un même nom de méthode → des comportements différents selon l'objet.

```java
// DANS VOTRE PROJET : Interface IOllamaService
public interface IOllamaService {
    String generatePhrase(String lang, String level);
    String feedback(String expected, String transcription, int score, String lang);
    boolean isHealthy();
}

// Implémentation 1 : Ollama local
@Service
public class OllamaService implements IOllamaService {
    @Override
    public String generatePhrase(String lang, String level) {
        // → appelle Ollama local (LLM sur votre serveur)
        return ollamaClientService.callRaw(system, prompt, maxTokens, 0.7, lang);
    }
}

// Implémentation 2 hypothétique : Azure OpenAI
public class AzureOllamaService implements IOllamaService {
    @Override
    public String generatePhrase(String lang, String level) {
        // → appelle Azure GPT-5.1 (cloud)
        return azureOpenAIService.chat(system, prompt, maxTokens);
    }
}

// Le Controller ne sait PAS quelle implémentation est utilisée :
@RestController
public class PracticeController {
    private final IOllamaService ollamaService; // ← POLYMORPHISME
    // Spring injecte automatiquement la bonne implémentation
}
```

**2 types de polymorphisme :**
- **Compilation (surcharge / overloading)** : même nom, paramètres différents
- **Exécution (réécriture / overriding)** : `@Override` dans la sous-classe

---

### Q5 : Qu'est-ce que l'abstraction ? Exemple ?

**R :** Cacher la complexité interne et exposer uniquement l'essentiel.

```java
// DANS VOTRE PROJET : Interface IPracticeService
public interface IPracticeService {
    // Le Controller sait QUOI faire (évaluer), pas COMMENT
    EvaluationResponse evaluate(MultipartFile audioFile,
                                String expectedPhrase,
                                String lang,
                                String level,
                                String username);
}

// L'implémentation cache la complexité :
@Service
public class PracticeService implements IPracticeService {
    @Override
    public EvaluationResponse evaluate(...) {
        // 1. Envoie audio à FastAPI (Whisper transcription)
        // 2. Calcule WER (Word Error Rate)
        // 3. Génère un score pondéré
        // 4. Appelle Ollama pour le feedback IA
        // 5. Persiste la tentative en base
        // 6. Met à jour la gamification (XP, streaks)
        // → Le Controller ne voit qu'UN SEUL appel .evaluate()
    }
}
```

**Le Controller ne connaît aucun de ces détails** → c'est l'abstraction.

---

## 2. Les 4 Piliers dans votre Projet

---

### Q6 : Montrez les 4 piliers de la POO en action dans votre architecture.

**R :**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE POO DU PROJET                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ABSTRACTION (interfaces)                                       │
│  ┌──────────────────────┐                                       │
│  │ IOllamaService       │ ← Le "quoi" : generatePhrase(),      │
│  │ IPracticeService     │   feedback(), evaluate()              │
│  │ IGamificationService │                                       │
│  └───────┬──────────────┘                                       │
│          │ implements (POLYMORPHISME)                            │
│          ▼                                                      │
│  ┌──────────────────────┐                                       │
│  │ OllamaService        │ ← Le "comment" : appelle LLM,        │
│  │ PracticeService      │   calcule WER, persiste tentative     │
│  │ GamificationService  │                                       │
│  └───────┬──────────────┘                                       │
│          │                                                      │
│  ENCAPSULATION (private + @Service)                             │
│  ┌──────────────────────┐                                       │
│  │ User entity          │ → passwordHash private, jamais        │
│  │ Attempt entity       │   exposé dans l'API (DTO filtre)      │
│  └──────────────────────┘                                       │
│                                                                 │
│  HÉRITAGE                                                       │
│  ┌──────────────────────┐                                       │
│  │ OncePerRequestFilter │ → JwtAuthFilter extends               │
│  │ JpaRepository        │ → UserRepository extends              │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Q7 : Différence entre classe abstraite et interface ?

**R :**

| Critère                 | Classe Abstraite          | Interface                        |
|-------------------------|---------------------------|----------------------------------|
| Héritage                | `extends` (un seul)       | `implements` (plusieurs)         |
| Méthodes concrètes      | ✅ Oui                    | ✅ Oui (default depuis Java 8)   |
| Constructeur            | ✅ Oui                    | ❌ Non                           |
| Attributs d'instance    | ✅ Oui                    | ❌ Uniquement constantes (static final) |
| Quand utiliser          | Relation "est un" (is-a)  | Relation "sait faire" (can-do)   |

**Dans votre projet :**
```java
// Interface = contrat de capacité
public interface IOllamaService { ... }      // "sait générer du texte IA"
public interface IPracticeService { ... }    // "sait évaluer la prononciation"
public interface IGamificationService { ... } // "sait gérer XP et badges"

// Classe abstraite = héritage de Spring
public abstract class OncePerRequestFilter { ... }
// → votre JwtAuthFilter extends OncePerRequestFilter
```

---

### Q8 : Qu'est-ce que la composition vs l'héritage ?

**R :** **Composition** = "a un" (has-a), **Héritage** = "est un" (is-a).

```java
// COMPOSITION dans votre projet (privilégiée) :
@Service
public class OllamaService implements IOllamaService {
    private final OllamaClientService ollamaClientService;   // HAS-A
    private final ChatbotService chatbotService;             // HAS-A
    private final FeedbackService feedbackService;           // HAS-A
    private final ExerciseService exerciseService;           // HAS-A
    private final LevelTestService levelTestService;         // HAS-A
    private final BattleService battleService;               // HAS-A
    // → OllamaService "a" ces services, il ne les hérite pas
}

// HÉRITAGE (quand il y a une relation "est un") :
public class JwtAuthFilter extends OncePerRequestFilter { ... }
// → JwtAuthFilter "est un" filtre HTTP
```

**Règle d'or : préférez la composition à l'héritage** → plus flexible, moins couplé.

---

### Q9 : Qu'est-ce que `@Override` ? Pourquoi l'utiliser ?

**R :** Indique qu'une méthode réécrit la méthode du parent. Le compilateur vérifie que la signature est correcte.

```java
@Service
public class GamificationService implements IGamificationService {

    @Override  // ✅ Le compilateur vérifie que cette méthode existe dans l'interface
    public void recordActivity(User user, int xpEarned, int score) {
        user.setTotalXp(user.getTotalXp() + xpEarned);
        // ... logique de streaks et badges
    }
}
```

---

### Q10 : Qu'est-ce que le couplage et la cohésion ?

**R :**
- **Couplage** = degré de dépendance entre classes (🔻 faible = mieux)
- **Cohésion** = degré de focus d'une classe sur une seule responsabilité (🔺 forte = mieux)

```
✅ Votre projet :
   GamificationService → ne gère QUE XP + badges + streaks (forte cohésion)
   FeedbackService     → ne gère QUE la génération de feedback IA
   LevelTestService    → ne gère QUE le test de niveau CEFR

   Services communiquent via interfaces (faible couplage)

❌ Anti-pattern :
   GodService → gère users + scores + emails + badges + IA
   (faible cohésion, fort couplage)
```

---

## 3. POO Avancée

---

### Q11 : Qu'est-ce que la surcharge (overloading) vs la réécriture (overriding) ?

**R :**

| Concept       | Overloading (surcharge)           | Overriding (réécriture)           |
|---------------|-----------------------------------|-----------------------------------|
| Quand         | Même classe                       | Classe fille                      |
| Quoi          | Même nom, paramètres différents   | Même signature exacte             |
| Résolution    | À la **compilation**              | À l'**exécution**                 |
| Polymorphisme | Statique                          | Dynamique                         |

```java
// OVERLOADING — même méthode, paramètres différents
public class OllamaService {
    String generatePhrase(String lang, String level) { ... }
    String generatePhrase(String lang, String level, int count) { ... } // surcharge
}

// OVERRIDING — redéfinir une méthode héritée
public class GamificationService implements IGamificationService {
    @Override
    public void recordActivity(User user, int xp, int score) { ... }
}
```

---

### Q12 : Qu'est-ce qu'un record en Java ? (Java 16+)

**R :** Classe immutable compacte — parfait pour les DTOs.

```java
// Avant (verbose)
public class EvaluationResponse {
    private int score;
    private String feedback;
    // + constructeur, getters, equals, hashCode, toString...
}

// Avec record (compact)
public record EvaluationResponse(
    int score,
    double wer,
    String transcription,
    String feedback
) {}
// → Java génère automatiquement constructeur, getters, equals, hashCode, toString
```

---

### Q13 : Qu'est-ce que Lombok ? Pourquoi l'utilisez-vous ?

**R :** Bibliothèque qui génère le code boilerplate (getters, setters, constructeurs) à la compilation.

```java
// DANS VOTRE PROJET : User.java utilise Lombok
@Entity
@Getter        // → génère tous les getters
@Setter        // → génère tous les setters
@RequiredArgsConstructor  // → constructeur avec les champs final
public class User {
    private Long id;
    private String email;
    private String passwordHash;
}

// Autres annotations Lombok utiles :
@Builder       // → pattern Builder
@ToString      // → toString()
@EqualsAndHashCode  // → equals() et hashCode()
@Data          // → @Getter + @Setter + @ToString + @EqualsAndHashCode
@AllArgsConstructor // → constructeur avec tous les champs
@NoArgsConstructor  // → constructeur vide
```

---

## 4. Intelligence Artificielle

---

### Q14 : Quelles technologies IA utilisez-vous dans votre projet ?

**R :**

| Technologie              | Rôle                                    | Couche               |
|--------------------------|-----------------------------------------|----------------------|
| **Whisper** (OpenAI)     | Speech-to-Text (transcription audio)    | FastAPI (Python)     |
| **Ollama** (LLM local)  | Génération de texte, feedback IA        | Spring Boot (Java)   |
| **Azure OpenAI GPT-5.1** | LLM cloud (alternative à Ollama)        | Spring Boot (Java)   |
| **librosa**              | Traitement du signal audio              | FastAPI (Python)     |
| **noisereduce**          | Réduction de bruit audio                | FastAPI (Python)     |
| **jiwer**                | Calcul du WER (Word Error Rate)         | FastAPI (Python)     |
| **Phonemizer**           | Conversion texte → phonèmes IPA        | FastAPI (Python)     |

---

### Q15 : Comment l'IA est-elle intégrée dans votre architecture ?

**R :**

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUX IA COMPLET                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Utilisateur parle dans le micro                             │
│              │                                                  │
│              ▼                                                  │
│  2. React envoie fichier audio → Spring Boot                    │
│              │                                                  │
│              ▼                                                  │
│  3. Spring Boot (PracticeService) → appelle FastAPI             │
│              │   POST /transcribe { audio_file }                │
│              ▼                                                  │
│  4. FastAPI → audio_engine.py                                   │
│     a. Prétraitement (noisereduce, butterworth filter)          │
│     b. Whisper STT → transcription                              │
│     c. Anti-hallucination (détection silence, fillers)          │
│     d. Calcul WER (jiwer) + score pondéré                      │
│              │                                                  │
│              ▼                                                  │
│  5. Résultat retourne à Spring Boot                             │
│              │                                                  │
│              ▼                                                  │
│  6. Spring Boot appelle Ollama/Azure OpenAI                     │
│     → Génère un feedback personnalisé en langage naturel        │
│              │                                                  │
│              ▼                                                  │
│  7. Spring Boot persiste : Attempt (score, WER, feedback)       │
│     + GamificationService (XP, streaks, badges)                 │
│              │                                                  │
│              ▼                                                  │
│  8. JSON Response → React → affiche score + feedback            │
└─────────────────────────────────────────────────────────────────┘
```

---

### Q16 : Qu'est-ce que le STT (Speech-to-Text) ? Comment ça marche ?

**R :** Convertir la parole en texte automatiquement.

```python
# Dans votre audio_engine.py — Whisper STT
from faster_whisper import WhisperModel

model = WhisperModel("medium", device="cpu", compute_type="int8")

def transcribe(audio_path, language="fr"):
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        word_timestamps=True
    )
    text = " ".join([seg.text for seg in segments])
    return text
```

**Pipeline de traitement :**
```
Audio brut
    │
    ▼  librosa.load() → resampling à 16kHz
    │
    ▼  noisereduce.reduce_noise() → suppression bruit
    │
    ▼  Butterworth bandpass filter → filtre fréquences
    │
    ▼  Whisper model.transcribe() → texte
    │
    ▼  Anti-hallucination check → validation
    │
    ▼  Texte nettoyé
```

---

### Q17 : Qu'est-ce que le WER (Word Error Rate) ? Comment le calculez-vous ?

**R :** Métrique qui mesure la distance entre le texte attendu et le texte transcrit.

```
WER = (Substitutions + Insertions + Deletions) / Nombre total de mots attendus
```

```python
# Dans votre projet — jiwer
from jiwer import wer as jiwer_wer

expected = "bonjour comment allez vous"
transcribed = "bonjour comment aller vous"

error_rate = jiwer_wer(expected, transcribed)  # 0.25 (1 erreur / 4 mots)
score = max(0, int((1 - error_rate) * 100))    # 75/100
```

**Votre innovation — scoring pondéré :**
```python
# Les mots de contenu comptent plus que les mots-outils
FUNCTION_WORD_WEIGHT = 0.4  # "le", "de", "un" → 40% du poids
# Les mots de contenu (noms, verbes) → 100% du poids

# Exemple :
# "Le chat mange la souris"
#  0.4  1.0  1.0  0.4  1.0  → les erreurs sur "chat", "mange", "souris" comptent plus
```

---

## 5. Whisper & Traitement Audio

---

### Q18 : Qu'est-ce que Whisper ?

**R :** Modèle d'IA open-source d'**OpenAI** pour la reconnaissance vocale (STT), entraîné sur 680 000 heures d'audio multilingue.

| Caractéristique | Détail                                    |
|-----------------|-------------------------------------------|
| Type            | Transformer (encoder-decoder)             |
| Entraînement    | 680k heures, 96 langues                   |
| Input           | Audio (mel-spectrogram 80 bins)           |
| Output          | Texte transcrit                           |
| Tailles         | tiny, base, small, medium, large          |
| Votre choix     | `faster-whisper` (optimisé CTranslate2)   |

---

### Q19 : Comment gérez-vous les hallucinations de Whisper ?

**R :** Whisper peut "inventer" du texte quand l'audio est silencieux ou bruité.

```python
# Votre audio_engine.py — Anti-hallucination

SILENCE_RMS_THRESHOLD = 0.005     # en dessous → silence détecté
LOW_CONFIDENCE_THRESHOLD = 0.30   # confiance trop basse → rejet

HALLUCINATION_PATTERNS = [
    r"^\s*$",                              # texte vide
    r"^(merci|thank you|thanks)\.?$",      # phrases génériques
    r"^sous-titres?\s",                    # "sous-titres réalisés par..."
    r"^(www\.|http)",                      # URLs
    r"^\[.*\]$",                           # [Musique], [Applaudissements]
]

# Vérifications :
# 1. RMS du signal < seuil → silence → rejet
# 2. Ratio speech/silence < 10% → pas assez de parole
# 3. Confiance Whisper < 30% → transcription douteuse
# 4. Pattern matching → hallucination connue → rejet
```

---

### Q20 : Qu'est-ce que la réduction de bruit ? Comment ça marche ?

**R :** Supprimer le bruit de fond (ventilateur, bruit ambiant) pour améliorer la qualité audio.

```python
# Votre pipeline audio :

import librosa
import noisereduce as nr
from scipy.signal import butter, sosfilt

# 1. Charger et resampler à 16kHz
audio, sr = librosa.load(audio_path, sr=16000)

# 2. Réduction de bruit (spectral gating)
audio_clean = nr.reduce_noise(y=audio, sr=sr)

# 3. Filtre Butterworth passe-bande (300 Hz - 3400 Hz)
# → garde uniquement les fréquences de la voix humaine
sos = butter(5, [300, 3400], btype='band', fs=sr, output='sos')
audio_filtered = sosfilt(sos, audio_clean)
```

---

## 6. LLM / Ollama / Azure OpenAI

---

### Q21 : Qu'est-ce qu'un LLM ? Comment l'utilisez-vous ?

**R :** **Large Language Model** — modèle d'IA entraîné sur de grandes quantités de texte pour comprendre et générer du langage naturel.

**Utilisation dans votre projet :**

| Fonctionnalité               | LLM fait quoi                                        |
|------------------------------|------------------------------------------------------|
| Feedback de prononciation    | Génère des conseils personnalisés en langage naturel  |
| Génération de phrases        | Crée des phrases adaptées au niveau CEFR              |
| Chatbot conversationnel      | Discussion interactive avec l'apprenant               |
| Exercices IA                 | Génère des exercices personnalisés                    |
| Synthèse de test de niveau   | Résume les forces/faiblesses après un test            |

---

### Q22 : Différence Ollama (local) vs Azure OpenAI (cloud) ?

**R :**

| Critère        | Ollama (local)              | Azure OpenAI (cloud)              |
|----------------|-----------------------------|------------------------------------|
| Déploiement    | Sur votre serveur           | Cloud Microsoft Azure              |
| Coût           | Gratuit (hardware propre)   | Pay-per-token                      |
| Latence        | ✅ Faible (réseau local)    | ❌ Variable (dépend du réseau)     |
| Modèles        | Llama, Mistral, Gemma...    | GPT-4, GPT-5.1                     |
| Confidentialité| ✅ Données restent locales  | ⚠️ Données envoyées au cloud       |
| Qualité        | Bonne (modèle small/medium) | ✅ Excellente (GPT-5.1)            |

**Votre architecture = fallback :**
```java
// Si Ollama est disponible → utiliser Ollama (local, gratuit)
// Si Ollama est down → basculer sur Azure OpenAI (cloud, payant)
if (ollamaService.isHealthy()) {
    return ollamaService.generatePhrase(lang, level);
} else {
    return azureOpenAIService.chat(system, prompt, maxTokens);
}
```

---

### Q23 : Qu'est-ce qu'un prompt ? Comment structurez-vous vos prompts ?

**R :** Instruction envoyée au LLM pour guider sa réponse.

```java
// DANS VOTRE PROJET : LevelTestService.java

// System prompt — rôle et contraintes du LLM
String system = "Tu génères UN texte parlé professionnel, "
    + "niveau CECR B1 : paragraphe de 30-45 mots, "
    + "vocabulaire corporate (gestion de projet, IT, développement). "
    + "Termine TOUJOURS par un point. "
    + "INTERDIT : introduction, guillemets, explication. "
    + "Réponds UNIQUEMENT avec le texte.";

// User prompt — la demande spécifique
String prompt = "Mots cibles : réunion, développement, agile. Texte :";

// Appel LLM
String result = ollamaClientService.callRaw(system, prompt, 200, 0.7, "fr");
```

**Structure d'un bon prompt :**
```
1. RÔLE     : "Tu es un professeur de prononciation française"
2. TÂCHE    : "Génère un texte professionnel de niveau B1"
3. CONTRAINTES : "30-45 mots, terminé par un point"
4. FORMAT   : "Réponds UNIQUEMENT avec le texte, pas d'explication"
5. CONTEXTE : "Mots cibles : réunion, agile, sprint"
```

---

### Q24 : Comment implémentez-vous le streaming IA ?

**R :** Le LLM envoie la réponse mot par mot (Server-Sent Events) → l'utilisateur voit le texte s'afficher progressivement.

```java
// Spring Boot → StreamService.java
@Service
public class StreamService {
    // SSE (Server-Sent Events) → streaming en temps réel
    public void streamResponse(String system, String prompt,
                                Consumer<String> onToken) {
        // Chaque token généré par le LLM est envoyé immédiatement au client
        ollamaClient.streamChat(system, prompt, token -> {
            onToken.accept(token);  // → React affiche le token
        });
    }
}
```

**React (client) :**
```javascript
const eventSource = new EventSource("/api/chat/stream?message=...");
eventSource.onmessage = (event) => {
    setResponse(prev => prev + event.data); // affiche mot par mot
};
```

---

## 7. Agent IA & Architecture Agentique

---

### Q25 : Qu'est-ce qu'un agent IA dans votre projet ?

**R :** Un système autonome qui planifie et exécute des étapes pour atteindre un objectif — utilisant un LLM comme "cerveau".

```
┌─────────────────────────────────────────────┐
│              AGENT IA (Level Test)           │
│                                             │
│  1. PERCEPTION  : reçoit l'audio utilisateur│
│  2. RÉFLEXION   : LLM analyse le score      │
│  3. PLANIFICATION: choisit le prochain son  │
│  4. ACTION      : génère une nouvelle phrase│
│  5. MÉMOIRE     : stocke l'historique       │
│  6. ADAPTATION  : ajuste la difficulté      │
│                                             │
│  Boucle autonome : répète jusqu'au test     │
│  complet (tous les sons testés)             │
└─────────────────────────────────────────────┘
```

**Implémentation dans votre LevelTestService :**
```java
// L'agent adapte la difficulté selon les résultats
public String adaptNextStep(String lang, String level, String targetSound,
                            int lastScore, String lastPhrase,
                            List<String> weakSounds) {
    // Le LLM décide quoi faire ensuite en fonction du score
    // → Si score < 50 : rester sur le même son (plus simple)
    // → Si score > 80 : passer au son suivant
    // → Si score > 90 : sauter le son (déjà maîtrisé)
}
```

---

### Q26 : Qu'est-ce que la boucle agent (Agent Loop) ?

**R :**

```
          ┌───────────────┐
          │  Observation  │ ← audio utilisateur + score
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │   Réflexion   │ ← LLM analyse les résultats
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │    Action     │ ← génère feedback + prochaine phrase
          └───────┬───────┘
                  │
          ┌───────▼───────┐
          │   Mémoire     │ ← sauvegarde dans ConcurrentHashMap
          └───────┬───────┘
                  │
                  ▼
           Test terminé ?
           Non → retour à Observation
           Oui → Synthèse finale (CEFR level)
```

---

## 8. Questions Générales

---

### Q27 : Qu'est-ce que le CEFR ? Comment le déterminez-vous ?

**R :** **Common European Framework of Reference** — échelle standard de compétence linguistique.

```
A1 → Débutant       │ Phrases simples, vocabulaire de base
A2 → Élémentaire    │ Situations quotidiennes
B1 → Intermédiaire  │ Voyage, travail, opinion simple
B2 → Indépendant    │ Discussions complexes, textes techniques
C1 → Avancé         │ Expression fluide, nuances
C2 → Maîtrise       │ Comprend tout, s'exprime naturellement
```

**Votre algorithme :**
```java
// Test de niveau = 6-8 sons différents testés
// Score moyen → mapping CEFR
if (avgScore >= 90) return "C2";
if (avgScore >= 80) return "C1";
if (avgScore >= 70) return "B2";
if (avgScore >= 60) return "B1";
if (avgScore >= 45) return "A2";
return "A1";
```

---

### Q28 : Qu'est-ce que la gamification ? Comment l'implémentez-vous ?

**R :** Utiliser des mécaniques de jeu pour motiver l'apprentissage.

```java
// DANS VOTRE PROJET : GamificationService.java
@Service
public class GamificationService implements IGamificationService {

    public void recordActivity(User user, int xpEarned, int score) {
        // 1. XP : ajouter les points d'expérience
        user.setTotalXp(user.getTotalXp() + xpEarned);

        // 2. STREAKS : jours consécutifs d'activité
        LocalDate today = LocalDate.now();
        if (lastActivity.isBefore(today.minusDays(1))) {
            user.setCurrentStreak(1);         // streak cassée
        } else if (lastActivity.isBefore(today)) {
            user.setCurrentStreak(streak + 1); // streak continue !
        }

        // 3. BADGES : récompenses débloquées
        if (streak >= 7)  awardBadge("STREAK_7");    // 🔥 7 jours consécutifs
        if (score >= 100) awardBadge("PERFECT_SCORE"); // ⭐ Score parfait
        if (totalXp >= 1000) awardBadge("XP_1000");   // 🏆 1000 XP
    }
}
```

**Éléments de gamification :**
- 🏆 **XP** (points d'expérience)
- 🔥 **Streaks** (jours consécutifs)
- 🎖️ **Badges** (FIRST_STEP, STREAK_7, PERFECT_SCORE, XP_1000)
- 📊 **Leaderboard / Battle** (compétition entre apprenants)

---

### Q29 : Qu'est-ce que la Spaced Repetition (Répétition Espacée) ?

**R :** Technique d'apprentissage qui espace les révisions de manière croissante pour optimiser la mémorisation.

```
Jour 1 : Apprendre "réunion" → revoir dans 1 jour
Jour 2 : Révisé avec succès  → revoir dans 3 jours
Jour 5 : Révisé avec succès  → revoir dans 7 jours
Jour 12: Révisé avec succès  → revoir dans 14 jours
```

```java
// Dans votre projet : SpacedRepetitionItem.java
@Entity
public class SpacedRepetitionItem {
    private String word;           // mot à réviser
    private LocalDate nextReview;  // prochaine date de révision
    private int interval;          // intervalle en jours
    private double easeFactor;     // facteur de facilité (SM-2 algorithm)
}
```

---

### Q30 : Qu'est-ce qu'une exception vérifiée vs non vérifiée en Java ?

**R :**

| Type                    | Doit être catchée ?  | Exemples                        |
|-------------------------|----------------------|---------------------------------|
| **Checked** (vérifiée)  | ✅ Oui (obligatoire) | `IOException`, `SQLException`   |
| **Unchecked** (runtime) | ❌ Non               | `NullPointerException`, `IllegalArgumentException` |
| **Error**               | ❌ Non               | `OutOfMemoryError`, `StackOverflowError` |

```java
// Votre projet : ResourceNotFoundException = unchecked (RuntimeException)
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
// → Pas besoin de try/catch, géré par @ControllerAdvice global
```

---

### Q31 : Qu'est-ce qu'une collection en Java ? Les types principaux ?

**R :**

```
Collection
├── List (ordonnée, doublons autorisés)
│   ├── ArrayList  → accès rapide par index
│   └── LinkedList → insertions/suppressions rapides
├── Set (non ordonnée, PAS de doublons)
│   ├── HashSet    → le plus rapide
│   └── TreeSet    → trié
└── Map (clé → valeur)
    ├── HashMap    → le plus rapide
    ├── LinkedHashMap → ordre d'insertion
    └── ConcurrentHashMap → thread-safe
```

```java
// Dans votre projet :
private final ConcurrentHashMap<String, String> feedbackCache = new ConcurrentHashMap<>();
// → thread-safe car plusieurs requêtes simultanées accèdent au cache
```

---

### Q32 : Qu'est-ce que les Streams Java ? Exemple ?

**R :** API fonctionnelle pour traiter des collections de manière déclarative.

```java
// Filtrer les tentatives avec score > 80 d'un utilisateur
List<Attempt> goodAttempts = attempts.stream()
    .filter(a -> a.getScore() > 80)
    .sorted(Comparator.comparing(Attempt::getCreatedAt).reversed())
    .limit(10)
    .collect(Collectors.toList());

// Calculer le score moyen
double avgScore = attempts.stream()
    .mapToInt(Attempt::getScore)
    .average()
    .orElse(0.0);
```

---

### Q33 : Qu'est-ce que Optional en Java ? Pourquoi l'utiliser ?

**R :** Container qui peut contenir ou non une valeur → évite les `NullPointerException`.

```java
// Dans vos repositories :
Optional<User> findByEmail(String email);

// Usage propre :
User user = userRepository.findByEmail("alice@test.com")
    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

// ❌ MAUVAIS : vérification null
User user = userRepository.findByEmail("alice@test.com");
if (user == null) { throw new Exception("..."); }
```

---

### Q34 : Qu'est-ce que `@Autowired` ? Les 3 types d'injection ?

**R :** Annotation Spring pour l'injection automatique de dépendances.

```java
// 1. ✅ INJECTION PAR CONSTRUCTEUR (recommandé)
@Service
public class GamificationService {
    private final UserRepository userRepo;
    private final BadgeRepository badgeRepo;

    // @Autowired implicite quand un seul constructeur
    public GamificationService(UserRepository userRepo, BadgeRepository badgeRepo) {
        this.userRepo = userRepo;
        this.badgeRepo = badgeRepo;
    }
}

// 2. ⚠️ INJECTION PAR SETTER
@Autowired
public void setUserRepo(UserRepository repo) { this.userRepo = repo; }

// 3. ❌ INJECTION PAR CHAMP (à éviter — pas testable)
@Autowired
private UserRepository userRepo;
```

**Pourquoi le constructeur est meilleur :**
- Champs `final` → immutables, thread-safe
- Objet toujours dans un état valide
- Facile à tester avec `new Service(mockRepo)`

---

### Q35 : Qu'est-ce que le pattern Observer dans votre projet ?

**R :** Un objet notifie d'autres objets quand son état change.

```java
// WebSocket = pattern Observer en pratique
// Le serveur "notifie" le client quand de nouvelles données arrivent

@Configuration
@EnableWebSocket
public class WebSocketConfig {
    // Les clients s'abonnent à un topic
    // Le serveur pousse les mises à jour en temps réel
}

// Cas d'usage dans votre projet :
// → Battle en temps réel : quand un joueur termine, l'autre est notifié
// → Streaming IA : chaque token généré est poussé au client
```

---

### Q36 : Qu'est-ce qu'une API stateless ? Pourquoi c'est important ?

**R :** Le serveur ne stocke **aucune** information de session entre deux requêtes. Chaque requête contient tout ce qui est nécessaire (JWT dans le header).

```
Requête 1: GET /api/users   → Authorization: Bearer eyJ...
Requête 2: POST /api/score  → Authorization: Bearer eyJ...
// Chaque requête est indépendante, le serveur ne "se souvient" de rien
```

**Pourquoi :**
- **Scalabilité** : ajouter des serveurs sans partager d'état
- **Fiabilité** : un serveur crash → un autre prend le relais
- **Simplicité** : pas de gestion de session côté serveur

---

### Q37 : Comment gérez-vous les fichiers audio dans votre architecture ?

**R :**

```
1. React  → enregistre audio via MediaRecorder API
2. React  → envoie le fichier via FormData (multipart/form-data)
3. Spring → PracticeController reçoit @RequestParam("audio") MultipartFile
4. Spring → FileStorageService sauvegarde le fichier sur disque
5. Spring → PythonSttClient envoie le fichier à FastAPI
6. FastAPI → audio_engine.py traite (denoise, Whisper) et retourne la transcription
7. Spring → calcule le score, génère le feedback, persiste Attempt
```

```java
// Votre PracticeController (simplifié)
@PostMapping("/evaluate")
public ResponseEntity<?> evaluate(
    @RequestParam("audio") MultipartFile audio,
    @RequestParam("phrase") String expectedPhrase,
    @RequestParam("lang") String lang) {
    
    EvaluationResponse result = practiceService.evaluate(audio, expectedPhrase, lang, ...);
    return ResponseEntity.ok(result);
}
```

---

### Q38 : Qu'est-ce que la sérialisation / désérialisation ?

**R :**
- **Sérialisation** : objet Java → JSON (pour envoyer via HTTP)
- **Désérialisation** : JSON → objet Java (pour recevoir via HTTP)

```java
// Spring Boot utilise Jackson automatiquement

// SÉRIALISATION : Java → JSON
UserDTO user = new UserDTO(1L, "Alice", "alice@test.com");
// → Jackson convertit en : {"id": 1, "name": "Alice", "email": "alice@test.com"}

// DÉSÉRIALISATION : JSON → Java
// Requête HTTP body : {"phrase": "bonjour", "lang": "fr"}
// → Jackson convertit en objet CreateAttemptRequest automatiquement
@PostMapping
public void create(@RequestBody CreateAttemptRequest request) { ... }
```

**Annotations utiles :**
- `@JsonIgnore` → exclure un champ de la sérialisation
- `@JsonProperty("customName")` → renommer un champ
- `@JsonIgnoreProperties` → ignorer des champs inconnus

---

### Q39 : Comment fonctionne la pagination ?

**R :** Diviser les résultats en pages pour éviter de charger toutes les données.

```java
// Spring Data JPA Pageable
@GetMapping("/attempts")
public Page<AttemptDTO> getAttempts(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size) {
    
    Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
    return attemptRepository.findAll(pageable).map(this::toDTO);
}

// URL : GET /api/attempts?page=0&size=20
// Réponse :
// {
//   "content": [...],
//   "totalPages": 5,
//   "totalElements": 100,
//   "number": 0
// }
```

---

### Q40 : Résumé — Comment les principes POO rendent votre projet maintenable ?

**R :**

```
┌─────────────────────────────────────────────────────────────────┐
│                    POO DANS SPEAKCOACH                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENCAPSULATION                                                  │
│    → User.passwordHash est private, jamais dans l'API           │
│    → GamificationService contrôle les règles XP/Badges          │
│                                                                 │
│  HÉRITAGE                                                       │
│    → JwtAuthFilter extends OncePerRequestFilter                 │
│    → UserRepository extends JpaRepository                       │
│                                                                 │
│  POLYMORPHISME                                                  │
│    → IOllamaService : OllamaService (local) vs Azure (cloud)   │
│    → IPracticeService : impl change sans toucher le Controller  │
│                                                                 │
│  ABSTRACTION                                                    │
│    → 8 interfaces dans /service/iservice/                       │
│    → Controller ne voit que evaluate(), pas le pipeline IA      │
│                                                                 │
│  RÉSULTAT → Code testable, maintenable, évolutif               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Les Principes SOLID dans SpeakCoach

---

### Q41 : Que signifie l'acronyme SOLID ?

**R :** Ce sont 5 principes de conception orientée objet qui rendent le code plus compréhensible, flexible et maintenable.

*   **S** : Single Responsibility Principle (Responsabilité Unique)
*   **O** : Open/Closed Principle (Ouvert/Fermé)
*   **L** : Liskov Substitution Principle (Substitution de Liskov)
*   **I** : Interface Segregation Principle (Ségrégation des Interfaces)
*   **D** : Dependency Inversion Principle (Inversion des Dépendances)

---

### Q42 : Pouvez-vous donner un exemple du "Single Responsibility Principle" (S) dans votre code ?

**R :** **Une classe ne doit avoir qu'une seule et unique raison de changer.** (Une seule responsabilité).

**Dans SpeakCoach :**
Au lieu d'avoir un "SuperService" qui fait tout, nous avons séparé les responsabilités :
*   `PracticeService` : Gère uniquement l'orchestration de l'évaluation (appel STT, calcul du score, sauvegarde).
*   `FeedbackService` : Génère uniquement le feedback textuel avec l'IA.
*   `GamificationService` : Calcule uniquement l'XP, les streaks et gère les badges.
*   `AudioEngine` (FastAPI) : Gère uniquement le traitement audio et la transcription.

Si on veut changer la façon dont on calcule l'XP, on ne modifie que `GamificationService`, sans risquer de casser la transcription audio.

---

### Q43 : Comment avez-vous appliqué le "Open/Closed Principle" (O) ?

**R :** **Ouvert à l'extension, fermé à la modification.** On doit pouvoir ajouter de nouvelles fonctionnalités sans modifier le code existant.

**Dans SpeakCoach :**
L'interface `IOllamaService` ou `IPracticeService` illustre parfaitement cela.
```java
public interface IOllamaService {
    String generatePhrase(String lang, String level);
    // ...
}
```
Si demain nous voulons passer de *Ollama* à *Claude* ou *Mistral* via API, nous allons créer une nouvelle classe `ClaudeService implements IOllamaService` **(Extension)**. Nous n'aurons **pas besoin de modifier** (Fermeture) le code de `LevelTestService` ou `PracticeController` qui utilisent cette interface.

---

### Q44 : Qu'est-ce que le "Liskov Substitution Principle" (L) et où est-il dans votre projet ?

**R :** **Les objets d'une classe parente doivent pouvoir être remplacés par des objets de ses classes filles sans altérer le bon fonctionnement.**

**Dans SpeakCoach :**
L'utilisation de Spring Data JPA en est le meilleur exemple.
```java
public interface UserRepository extends JpaRepository<User, Long> { ... }
```
A l'exécution, Spring injecte une implémentation proxy générée dynamiquement (classe fille) qui remplace l'interface `UserRepository` (classe parente/abstraite). Notre service utilise les méthodes `.save()` ou `.findById()` sans savoir comment l'implémentation sous-jacente est faite, et le comportement reste garanti (Liskov respecté).

Un autre exemple est notre `IFileStorageService`. Si on passe d'un stockage local (`LocalFileStorageService`) à un stockage AWS S3 (`S3FileStorageService`), le reste de l'application continuera de fonctionner sans erreur.

---

### Q45 : Quel est l'intérêt du "Interface Segregation Principle" (I) dans votre architecture ?

**R :** **Préférer plusieurs interfaces spécifiques plutôt qu'une seule interface générale et fourre-tout.** Le client ne doit pas dépendre de méthodes qu'il n'utilise pas.

**Dans SpeakCoach :**
Plutôt que de créer une immense interface `IAIService` regroupant l'audio et le texte, nous avons :
1.  `IPythonAnalyzeClient` (dédié à l'envoi d'audio vers FastAPI)
2.  `IOllamaService` (dédié à la génération de texte LLM)
3.  `IGamificationService` (dédié au jeu)

Ainsi, le `GamificationService` n'a aucune idée de ce qu'est un fichier audio, et le client Python n'est pas forcé d'implémenter des méthodes de génération de badges.

---

### Q46 : Comment Spring Boot facilite-t-il le "Dependency Inversion Principle" (D) ?

**R :** **Il faut dépendre des abstractions, pas des implémentations.** Les modules de haut niveau ne doivent pas importer directement les modules de bas niveau.

**Dans SpeakCoach :**
Nous utilisons l'**Injection de Dépendances (DI)** de Spring via les constructeurs.

```java
@Service
public class PracticeService implements IPracticeService {
    // On dépend de l'ABSTRACTION (Interfaces)
    private final IPythonAnalyzeClient pythonAnalyzeClient;
    private final IOllamaService ollamaService;

    // Spring injecte l'IMPLÉMENTATION concrète au démarrage
    public PracticeService(IPythonAnalyzeClient pythonAnalyzeClient, IOllamaService ollamaService) {
        this.pythonAnalyzeClient = pythonAnalyzeClient;
        this.ollamaService = ollamaService;
    }
}
```
`PracticeService` (haut niveau) ne fait jamais `new OllamaServiceImpl()` (bas niveau). Il dépend de l'interface `IOllamaService`. Le conteneur IoC de Spring Boot gère cette inversion de contrôle.

---

*📅 Partie 2 — POO, IA, Principes SOLID et Questions Générales — Bon courage !* 🚀
