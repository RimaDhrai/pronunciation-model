# 🎯 Analyse des 7 Piliers de l'Agentique IA
## Couverture dans la Présentation SpeakCoach

---

## 📊 Résumé Exécutif

La présentation **SpeakCoach — Agentique IA** couvre **TOUS LES 7 PILIERS** essentiels pour la construction d'agents autonomes et fiables.

| # | Pilier | Présent | Détail | Slide |
|---|--------|---------|--------|-------|
| 1 | **Prompt Engineering** | ✅ | Structuration des prompts, contraintes, format JSON | 02/08 |
| 2 | **Context Engineering** | ✅ | Gestion mémoire court/long terme, CheckPointer | 03/08 |
| 3 | **Tool Calling** | ✅ | FastAPI, PostgreSQL, ML, Générateur contenu | 04/08 |
| 4 | **Observability** | ✅ | Logs, Traces distribuées, État partagé | 05/08 |
| 5 | **Agent Loop** | ✅ | Boucle Perception → Raisonnement → Action → Feedback | 06/08 |
| 6 | **Safety** | ✅ | Limites contexte, Validations, Rate limiting | 07/08 |
| 7 | **Agent Harness** | ✅ | LangGraph, Master Agent, Spring AI | 08/08 |

---

## 🔍 Détail par Pilier

### 1️⃣ **PROMPT ENGINEERING** ✅
**Objectif** : Structurer les instructions pour un raisonnement prévisible

**Présent dans SpeakCoach :**
- ✅ **Role-based prompts** : "Tu es un coach de prononciation"
- ✅ **Objectif clair** : "Générer des phrases pour pratiquer le son /ʃ/"
- ✅ **Contraintes** : Longueur, complexité (B1 CECRL), format de sortie
- ✅ **Format JSON** : Structuration des réponses pour parsing fiable
- ✅ **Few-shot examples** : Exemples dans les prompts

**Exemples d'implémentation :**
```java
// Spring AI - Prompt avec structure claire
String prompt = """
Role: Spécialiste en prononciation
Objectif: Générer 5 phrases pour /ʃ/ au niveau B1
Contraintes: 50-80 caractères, format JSON
Format attendu: {"phrases": [{"text": "...", "phonemes": [...]}]}
""";
```

**Bénéfices réalisés :**
- 🎯 Réponses du LLM prévisibles et parsables
- 🔒 Contrôle fin du comportement
- 📊 Réduction des hallucinations

---

### 2️⃣ **CONTEXT ENGINEERING** ✅
**Objectif** : Gestion intelligente de la mémoire et du contexte

**Présent dans SpeakCoach :**
- ✅ **Mémoire Court Terme (Session)**
  - State JSON avec profil utilisateur
  - CheckPointer pour sauvegarde LangGraph
  - Chat history (messages récents)
  
- ✅ **Mémoire Long Terme (Persistance)**
  - PostgreSQL pour historique persistant
  - Stats XP et progression
  - Weak words (points faibles identifiés)

- ✅ **Pipeline de Contexte**
  - Enrichissement avant chaque appel LLM
  - Profil (CECRL, langue)
  - Historique (sons récemment pratiqués)
  - Erreurs (sons mal prononcés)
  - Objectif (cible pédagogique)

**Exemples d'implémentation :**
```java
// Session Memory (court terme)
Map<String, Object> sessionState = new HashMap<>();
sessionState.put("userId", 123);
sessionState.put("currentLevel", "B1");
sessionState.put("lastSound", "/ʃ/");

// CheckPointer - Sauvegarde état LangGraph
checkpointer.put(sessionId, graphState);

// Long terme - PostgreSQL
SELECT * FROM user_sessions WHERE userId = 123;
SELECT weak_words FROM user_progress WHERE userId = 123;
```

**Architecture en couches :**
```
┌─────────────────────────────────┐
│   Requête Utilisateur           │
└──────────────┬──────────────────┘
               │
         Contexte Enrichissement
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
  Profil   Historique  Erreurs
    │          │          │
    └──────────┼──────────┘
               │
        ┌──────▼────────┐
        │  Appel LLM    │
        │  (+ contexte) │
        └─────────────────┘
```

**Bénéfices réalisés :**
- 🧠 Agent "se souvient" du contexte utilisateur
- 📈 Recommandations personnalisées
- 🔄 Reprise de session sans perte d'info

---

### 3️⃣ **TOOL CALLING** ✅
**Objectif** : Donner au LLM accès à des outils externes

**Présent dans SpeakCoach :**
- ✅ **Analyse Vocale (FastAPI Python)**
  - Évaluation phonétique des enregistrements
  - Calcul score /100
  - Diagnostic erreurs (WER, F1 score)
  - Retour au LLM pour feedback intelligent

- ✅ **Base de Données (PostgreSQL)**
  - Sauvegarde progression utilisateur
  - Historique sessions complet
  - Badges & XP
  - Requêtes pour contexte enrichi

- ✅ **Générateur de Contenu**
  - Génération dynamique de phrases avec IPA
  - Conseils de correction ciblés
  - Synthèse feedback personnalisée

- ✅ **Modèles ML**
  - Reconnaissance phonétique
  - Similarité phonémique
  - Prédiction progression

**Exemples de Tool Calls :**
```java
// Agent appelle FastAPI pour évaluation vocale
String audioResponse = callVoiceEvaluator(userAudio, targetPhoneme);
// Retour: {"score": 78, "wer": 0.15, "errors": ["..."]}

// Agent requête DB pour historique
List<UserAttempt> history = userRepository.findLastAttempts(userId, 20);

// Agent génère contenu via LLM
String feedback = generateCorrectionAdvice(diagnosticResult, userLevel);
```

**Flow Tool Calling :**
```
LLM (raisonnement)
  │
  ├─→ Tool: evaluate_audio() ─→ FastAPI
  ├─→ Tool: get_user_history() ─→ PostgreSQL
  ├─→ Tool: generate_feedback() ─→ LLM + Templates
  │
  └─→ Observation (résultats outils)
  └─→ Intégration résultats
  └─→ Réponse finale utilisateur
```

**Bénéfices réalisés :**
- 🚀 Agent peut faire des actions réelles (pas juste du texte)
- 🎯 Évaluations phonétiques précises
- 📊 Personnalisation basée sur données réelles

---

### 4️⃣ **OBSERVABILITY** ✅
**Objectif** : Visibilité complète du comportement de l'agent

**Présent dans SpeakCoach :**
- ✅ **Logs Structurés**
  - Décisions de routing (quel agent choisi ?)
  - Prompts et réponses LLM
  - Appels outils (quels paramètres ?)
  - Erreurs et exceptions
  - Temps d'exécution par composant

- ✅ **Traces Distribuées**
  - Suivi complet du flux requête
  - Latence par étape (LLM, DB, FastAPI)
  - Call stack du LangGraph
  - Corrélation entre events

- ✅ **État Partagé (Shared State)**
  - Snapshot de l'état interne à chaque moment clé
  - CheckPoint sauvegardés à chaque étape
  - Métriques en temps réel

- ✅ **Alertes & Métriques**
  - Taux d'erreur agent
  - Latence anormale (seuils)
  - Détection boucles infinies
  - Taux utilisation tokens LLM

**Implémentation avec Spring AI + LangGraph :**
```java
// Logs structurés
log.info("Agent routing decision: {} -> {}", requestType, selectedAgent);
log.info("LLM request: model={}, tokens={}", model, tokenCount);

// Traces distribuées (OpenTelemetry)
@Traced
public String callLLM(String prompt) {
    // Span automatique avec latence
    return chatClient.call(prompt);
}

// État partagé
StateGraph graph = StateGraph.builder()
    .withCheckpointer(checkpointer)  // Sauvegarde état
    .withLogging(true)               // Logs automatiques
    .build();

// Métriques
meterRegistry.timer("agent.step.latency").record(() -> {
    // Exécution étape
});
```

**Dashboard de Monitoring (exemple) :**
```
┌─ Agent Performance ─────────────────┐
│ Requêtes/sec: 45                    │
│ Latence moyenne: 245ms              │
│ Taux d'erreur: 0.8%                 │
│ Tokens/jour: 2.3M / 5M limit        │
├─ Recent Traces ─────────────────────┤
│ 12:34:56 → Chatbot agent (156ms)    │
│ 12:34:57 → voice_eval (1240ms)      │
│ 12:34:58 → gen_feedback (89ms)      │
└─────────────────────────────────────┘
```

**Bénéfices réalisés :**
- 🔍 Débogage facile des problèmes
- 📊 Optimisation basée sur données réelles
- ⚠️ Détection précoce des anomalies
- 📈 SLA tracking et garanties

---

### 5️⃣ **AGENT LOOP** ✅
**Objectif** : La boucle autonome de perception-décision-action

**Présent dans SpeakCoach :**

#### **Boucle Standard (5 étapes) :**
1. **Perception** 👁️
   - Requête utilisateur reçue
   - Contexte enrichi (profil, historique, erreurs)
   - État de session chargé

2. **Raisonnement** 🧠
   - LLM analyse le contexte complet
   - Décide quelle action prendre :
     - Appel outil ? (évaluation vocale, génération)
     - Réponse directe ?
     - Routing vers autre agent ?

3. **Action** ⚡
   - Exécution de la décision
   - Appel API / DB / LLM
   - Modification état utilisateur

4. **Feedback** 📊
   - Observation du résultat
   - Mise à jour de l'état
   - Vérification de la contrainte (succès/échec ?)

5. **Boucle** 🔄
   - Si besoin : continuer la boucle
   - Sinon : réponse finale utilisateur

#### **Exemple Concret : Test de Prononciation**

```
Itération 1 :
  Perception: Utilisateur choix = "Tester /ʃ/"
              Contexte: Niveau B1, 50 tentatives réussies
  
  Raisonnement: → Appeler pick_sound()
                → Appeler gen_content() (générer 20 phrases)
  
  Action: pick_sound() retourne "/ʃ/"
          gen_content() retourne 20 phrases IPA
  
  Feedback: Phrases prêtes, lancé à l'utilisateur
  
Itération 2 (pour chaque phrase de la boucle de 20) :
  Perception: Utilisateur s'enregistre + audio reçu
  
  Raisonnement: → Appeler evaluate_audio()
                → Décider: Score ≥ 70 ? (Succès/Échec)
  
  Action: evaluate_audio() score = 78
          CheckPointer: +1 XP, save session
          
  Feedback: Score > 70 → Succès
            Continuer phrase suivante
  
Itération 20 :
  [Idem itération 2, puis après 20 itérations...]
  
  Raisonnement: → Appeler gen_feedback()
                → Synthèse complète des 20 sons
  
  Action: Synthèse complète générée
          XP total calculé
          Progression sauvegardée
  
  Feedback: Résultat final affiché utilisateur
```

**Code (Spring Boot + LangGraph) :**
```java
// Boucle Agent avec LangGraph
StateGraph<AgentState> graph = new StateGraph<>(AgentState.class);

// Nœuds = étapes de la boucle
graph.addNode("perceive", perceiveStep);           // Perception
graph.addNode("reason", reasonStep);               // Raisonnement
graph.addNode("act", actStep);                     // Action
graph.addNode("feedback", feedbackStep);           // Feedback

// Fluxe et conditions
graph.addEdge("perceive", "reason");
graph.addConditionalEdges("reason", 
    state -> state.shouldContinue() ? "act" : "feedback");
graph.addEdge("act", "feedback");
graph.addConditionalEdges("feedback",
    state -> state.needsLoop() ? "perceive" : "END");

// Exécution de la boucle
CompiledStateGraph compiled = graph.compile();
AgentState result = compiled.invoke(initialState);
```

**Bénéfices réalisés :**
- 🤖 Agent autonome (pas besoin d'intervention humaine entre étapes)
- 🔄 Adaptation dynamique selon résultats
- 📈 Qualité itérative (amélioration au fil de la boucle)

---

### 6️⃣ **SAFETY** ✅
**Objectif** : Garde-fou et validations

**Présent dans SpeakCoach :**

#### **1. Limites du Contexte**
- ✅ Max tokens par session (ex: 4000 tokens max)
- ✅ Éviction du contexte ancien (sliding window)
- ✅ TTL (Time To Live) sur les messages

```java
// Limiter la taille du contexte
if (contextTokens > MAX_TOKENS) {
    // Éviction contexte ancien
    context.removeOldestMessages(10);
}
```

#### **2. Validations de Sortie**
- ✅ Parsing JSON strict (SchemaValidator)
- ✅ Validation du schéma (JSONSchema)
- ✅ Fallback en cas d'erreur parsing

```java
// Validation schéma strict
ObjectMapper mapper = new ObjectMapper();
PhraseResponse response = mapper.readValue(
    llmOutput, 
    PhraseResponse.class
);
// Lève exception si format invalide → fallback
```

#### **3. Rate Limiting & DoS**
- ✅ Limite requêtes/minute par utilisateur
- ✅ Budget tokens LLM (ex: 1M tokens/jour)
- ✅ Timeout actions (ex: 5s max par appel)

```java
@RateLimiter(name = "user-agent", fallbackMethod = "limitExceeded")
public void callAgent(String userId) {
    // Max 100 requêtes/min par utilisateur
}

// Budget tokens
if (dailyTokenCount > TOKEN_BUDGET) {
    throw new QuotaExceededException("Budget LLM dépassé");
}

// Timeout
executorService.submit(
    () -> callLLM(prompt),
    Duration.ofSeconds(5)
);
```

#### **4. Vérification de Pertinence**
- ✅ Niveau adapté à l'apprenant (CECRL validation)
- ✅ Détection boucles infinies (max itérations)
- ✅ Authentification + autorisation

```java
// Vérifier niveau adapté
if (userLevel == "A1" && requestLevel == "C2") {
    throw new InvalidLevelException("Trop difficile pour cet apprenant");
}

// Détecter boucles infinies
if (loopIterations > MAX_ITERATIONS) {
    log.error("Boucle infinie détectée, arrêt");
    return fallbackResponse();
}

// Auth + Authz
@PreAuthorize("hasRole('USER')")
public void testPronunciation(Long userId) {
    // Vérifier userId == currentUser
}
```

**Bénéfices réalisés :**
- 🛡️ Protection contre les abus (DoS, injection)
- 🎯 Qualité pédagogique (niveau adapté)
- 💰 Coût LLM maîtrisé (budgets respectés)
- ⏱️ Performance prévisible (timeouts)

---

### 7️⃣ **AGENT HARNESS** ✅
**Objectif** : Infrastructure d'orchestration et d'exécution

**Présent dans SpeakCoach :**

#### **🔗 LangGraph (via Spring AI)**
- ✅ State management (gestion d'état distribué)
- ✅ Graph routing (routing basé sur conditions)
- ✅ Checkpoints intégrés (persistance d'état)
- ✅ Cycle loops handled (gestion des boucles)

```java
// LangGraph via Spring AI (LangGraph4J)
StateGraph<AgentState> graph = new StateGraph<>(AgentState.class);

graph.addNode("master", masterAgentNode);
graph.addNode("chatbot", chatbotAgentNode);
graph.addNode("test", testAgentNode);
graph.addNode("exercise", exerciseAgentNode);

// Routing conditionnel
graph.addConditionalEdges("master",
    state -> state.getAgentType(),  // Détermine destination
    Map.of(
        "chat" -> "chatbot",
        "test" -> "test",
        "exercise" -> "exercise"
    )
);

// Checkpointer pour persistance
graph.compile(checkpointer);
```

#### **🎯 Master Agent (Routing Central)**
- ✅ Orchestre 3 agents spécialisés
  - **Chatbot Agent** : Conversations libres
  - **LevelTest Agent** : Évaluation niveau CECRL
  - **Exercise Agent** : Exercices ciblés

```
Requête utilisateur
        │
    ┌───▼────────────┐
    │  Master Agent  │ (lit profil, décide)
    │  (LangGraph)   │
    └───┬────────────┘
        │
    ┌───┴──────────────────┐
    │                      │
    ▼                      ▼                      ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Chatbot      │  │ LevelTest    │  │ Exercise     │
│ Agent        │  │ Agent        │  │ Agent        │
│              │  │              │  │              │
│ ✓ Dialogue   │  │ ✓ pick_sound │  │ ✓ Ex level   │
│ ✓ Context    │  │ ✓ 20 phonèmes│  │ ✓ Feedback   │
│ ✓ Personnalis│  │ ✓ Évaluation │  │ ✓ Progress   │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### **📦 Spring AI ChatClient (Abstraction LLM)**
- ✅ Backend interchangeable (Ollama ou Azure OpenAI)
- ✅ Fallback automatique (local → cloud)
- ✅ Streaming SSE (réponses temps réel)

```java
// Spring AI - Abstraction LLM
@Autowired
ChatClient chatClient;

public String generateFeedback(String context) {
    // Même code, backend interchangeable
    return chatClient.prompt()
        .user(context)
        .call()
        .content();
}

// Configuration - Dev (Ollama)
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.model=qwen2.5:3b

// Configuration - Prod (Azure)
spring.ai.azure.openai.api-key=${AZURE_API_KEY}
spring.ai.azure.openai.endpoint=${AZURE_ENDPOINT}
```

#### **🏗️ Stack Technique Complet**

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                    │
│          Components ← SSE Streaming ← Agent             │
└─────────────────┬───────────────────────────────────────┘
                  │ REST / SSE
┌─────────────────▼───────────────────────────────────────┐
│              Backend (Spring Boot 3)                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │        Master Agent (LangGraph4J)                   │ │
│ │                                                     │ │
│ │  ├─ Chatbot Agent                                  │ │
│ │  ├─ LevelTest Agent                                │ │
│ │  └─ Exercise Agent                                 │ │
│ │                                                     │ │
│ │ State Management | CheckPointer | Routing Logic    │ │
│ └─────────────────────────────────────────────────────┘ │
│                       ▲                                  │
│          ┌────────────┼────────────┐                    │
│          │            │            │                    │
│   ┌──────▼────┐  ┌────▼────┐ ┌───▼────────┐           │
│   │ FastAPI   │  │Database │ │ Spring AI  │           │
│   │ (Voice)   │  │ (PG)    │ │ (LLM)      │           │
│   └───────────┘  └─────────┘ └────────────┘           │
│                                                         │
│   ⚙️ Ollama local (dev) ← Switch → 🌐 Azure (prod)   │
└─────────────────────────────────────────────────────────┘
              │                              │
         Services Python (ML)          External LLMs
```

**Bénéfices réalisés :**
- 🔀 Routing intelligent basé sur contexte
- 🔄 Persistence d'état (sessions reprises)
- ⚙️ Infrastructure scalable (microservices)
- 🔀 LLM interchangeable (Ollama ↔ Azure)

---

## 📋 Résumé de Couverture

### ✅ Tous les 7 piliers couverts dans SpeakCoach

| Pilier | État | Niveau de Maturité | Notes |
|--------|------|-------------------|-------|
| 1️⃣ Prompt Engineering | ✅ | Avancé | Prompts structurés, role-based, constrains clairs |
| 2️⃣ Context Engineering | ✅ | Avancé | Mémoire court/long terme, CheckPointer intégré |
| 3️⃣ Tool Calling | ✅ | Avancé | 4+ outils intégrés (FastAPI, DB, ML, LLM) |
| 4️⃣ Observability | ✅ | Moyen | Logs, traces, état partagé (à enrichir) |
| 5️⃣ Agent Loop | ✅ | Avancé | Boucles complètes avec feedback |
| 6️⃣ Safety | ✅ | Avancé | Limites contexte, validations, rate limiting |
| 7️⃣ Agent Harness | ✅ | Avancé | LangGraph, Master Agent, Spring AI |

---

## 🎓 Recommandations pour l'Encadrant

### Points Forts à Mettre en Avant :
✅ **Architecture moderne et complète** - Les 7 piliers d'agentique IA sont implé
✅ **Agents spécialisés** - Chatbot, Test, Exercise (pas un monolithe)
✅ **Mémoire distribuée** - Court/long terme, CheckPointer
✅ **Tool calling avancé** - Intégration multi-services (Voice, DB, LLM)
✅ **Boucles autonomes** - Perception → Raisonnement → Action → Feedback
✅ **Sécurité** - Rate limiting, validations, limites contexte
✅ **Infrastructure flexible** - LLM interchangeable (Ollama ↔ Azure)

### Points à Améliorer :
⚠️ **Observability** - Ajouter plus de metrics/alertes
⚠️ **Documentation** - Ajouter plus de traces de test/validation
⚠️ **Performance** - Optimiser latence LLM (caching)

---

## 📁 Fichiers Fournis

- **`slides_agents_ia_RESTRUCTURE.html`** : Présentation réorganisée des 7 piliers
  - 8 slides claires et organisées
  - Une slide par pilier + slide récapitulative
  - Design moderne sans lignes désordonnées
  - Navigation fluide (navigation dots, keyboard)

---

**Auteur** : Agent de Documentation IA  
**Date** : 2026-06-09  
**Projet** : SpeakCoach — Pronunciation Training Platform
