# 🎯 Guide de Présentation — SpeakCoach Agentique IA

## 📋 Vue d'ensemble

Ce dossier contient une **présentation restructurée et complète** sur l'architecture agentique IA de SpeakCoach, couvrant les **7 piliers essentiels** de l'agentique IA.

---

## 📁 Fichiers Fournis

### 1. **Présentation HTML (Interactive)**
- **Fichier** : `slides_agents_ia_RESTRUCTURE.html`
- **Format** : HTML5 avec CSS animations
- **Contenu** : 8 slides (1 récap + 7 piliers)
- **Ouverture** : Double-clic ou `open slides_agents_ia_RESTRUCTURE.html`
- **Navigation** : 
  - Navigation dots (droite)
  - Flèches clavier (↑↓)
  - Space pour scroller
  - Scroll fluide (smooth scroll)

### 2. **Documents d'Analyse**
- **`RESUME_EXECUTIF_7_PILIERS.md`** (Court, pour l'encadrant)
  - Vue rapide de la couverture
  - Talking points clés
  - Statistiques principales
  
- **`ANALYSE_7_PILIERS_AGENTIQUE.md`** (Détaillé, complet)
  - Analyse ligne par ligne
  - Exemples de code (Spring AI)
  - Diagrammes architecturaux
  - Recommandations

### 3. **Diagrammes PlantUML (Organisés)**
- **`ARCHITECTURE_AGENTS_CLEAN.puml`**
  - Architecture globale propre
  - Flux de données clairs
  - Master Agent + 3 agents spécialisés
  
- **`AGENT_LOOP_CYCLE.puml`**
  - Cycle perception → raisonnement → action → feedback
  - Boucles itératives
  - Points de décision
  
- **`7_PILLARS_FRAMEWORK.puml`**
  - Les 7 piliers interconnectés
  - Relations entre composants
  - Framework conceptuel complet

---

## 🎓 Comment Utiliser

### **Pour une Présentation Rapide (5 min)** ⏱️
1. Ouvrir `slides_agents_ia_RESTRUCTURE.html`
2. Parcourir slides 0-1 (7 piliers overview)
3. Mentionner les 3 agents spécialisés (slide 7)
4. Conclure avec couverture 100% ✅

### **Pour une Présentation Détaillée (15-20 min)** 📊
1. Ouvrir présentation HTML
2. Parcourir tous les 8 slides (1 par pilier)
3. Pour chaque pilier, montrer exemples dans `ANALYSE_7_PILIERS_AGENTIQUE.md`
4. Terminer avec diagrammes PlantUML

### **Pour Validation Académique** 🏫
1. Lire `RESUME_EXECUTIF_7_PILIERS.md` (contexte rapide)
2. Approfondir avec `ANALYSE_7_PILIERS_AGENTIQUE.md` (preuves)
3. Diagrammes PlantUML = documentation architectural

---

## 📊 Les 7 Piliers Résumé

| # | Pilier | SpeakCoach | Slide |
|---|--------|-----------|-------|
| 1 | **Prompt Engineering** | Prompts structurés, role-based | 02/08 |
| 2 | **Context Engineering** | Memory court/long terme + CheckPointer | 03/08 |
| 3 | **Tool Calling** | FastAPI + PostgreSQL + ML + LLM | 04/08 |
| 4 | **Observability** | Logs + Traces + Shared State | 05/08 |
| 5 | **Agent Loop** | Boucle Perception→Décision→Action | 06/08 |
| 6 | **Safety** | Limites, Validations, Rate-limiting | 07/08 |
| 7 | **Agent Harness** | LangGraph + Spring AI | 08/08 |

✅ **Couverture** : 7/7 (100%)

---

## 🏗️ Architecture Vue Rapide

```
Frontend (React)
      ↓ REST/SSE
Master Agent (LangGraph)
      ├→ Chatbot Agent
      ├→ LevelTest Agent
      └→ Exercise Agent
             ↓
    ┌───────┼───────┐
    ↓       ↓       ↓
  FastAPI PostgreSQL Spring AI
                    ├→ Ollama (dev)
                    └→ Azure OpenAI (prod)
```

---

## 🎨 Design des Slides

### ✨ Caractéristiques
- ✅ **Design moderne** : Dark mode, gradient colors
- ✅ **Pas de lignes désordonnées** : Grilles nettes, organisation claire
- ✅ **Animations fluides** : Fade-ups, transitions
- ✅ **Responsive** : Mobile + Desktop
- ✅ **Navigation intuitive** : Dots, keyboard, scroll
- ✅ **Couleurs cohérentes** : 7 couleurs pour 7 piliers

### 🎯 Chaque Slide Contient
- **Titre clair** + Tag thématique
- **Subtitle explicatif**
- **Contenu structuré** (cards ou listes)
- **Exemples concrets** (code, diagrammes)
- **Numérotation** (X/08)
- **Navigation facile** (dots + keyboard)

---

## 💻 Visualiser les Diagrammes PlantUML

### Option 1 : VS Code (Recommandé)
1. Installer extension "PlantUML" (jgraph.plantuml-visual-studio-code)
2. Ouvrir `.puml` file
3. Right-click → "Preview Current Diagram"

### Option 2 : Plantuml.com Online
1. Aller sur https://www.plantuml.com/plantuml/uml/
2. Copier-coller contenu fichier `.puml`
3. Voir diagramme généré

### Option 3 : Generate PNG locally
```bash
# Si plantuml CLI installé
plantuml ARCHITECTURE_AGENTS_CLEAN.puml -o diagrams/
```

---

## 🎯 Talking Points par Pilier

### 📝 Pilier 1 : Prompt Engineering
> "Les prompts ne sont pas vagues. Chaque prompt a un ROLE, une CIBLE, des CONTRAINTES et un FORMAT attendu. C'est comment on contrôle le comportement du LLM."

### 🧠 Pilier 2 : Context Engineering
> "L'agent a une mémoire sur 2 niveaux : court-terme (session en cours) et long-terme (PostgreSQL). Cela lui permet de personnaliser, d'adapter et de mémoriser."

### 🔧 Pilier 3 : Tool Calling
> "L'agent n'est pas limité au texte. Il peut appeler FastAPI pour évaluer audio, PostgreSQL pour récupérer l'historique, ou des modèles ML pour scorer."

### 📊 Pilier 4 : Observability
> "Tout est loggé, tracé, observable. CheckPointer sauvegarde l'état à chaque étape. Si quelque chose déraille, on peut rejouer exactement ce qui s'est passé."

### 🔄 Pilier 5 : Agent Loop
> "L'agent fonctionne en boucle autonome : il PERÇOIT le contexte, RAISONNE sur quoi faire, AGIT, puis OBSERVE le résultat pour s'adapter. Pas besoin d'intervention humaine entre les étapes."

### 🛡️ Pilier 6 : Safety
> "On définit des garde-fou : limites de contexte, validations strictes, rate limiting, timeouts. L'agent ne peut pas faire n'importe quoi."

### ⚙️ Pilier 7 : Agent Harness
> "LangGraph + Spring AI = infrastructure d'orchestration professionnelle. On peut swapper le LLM (Ollama → Azure) sans toucher le code, tant que l'interface reste la même."

---

## 📈 Statistiques Clés à Mettre en Avant

```
🎯 Couverture Agentique    : 7/7 piliers ✅
🧩 Agents Spécialisés       : 3 (Chatbot, Test, Exercise)
🔧 Outils Intégrés          : 4+ (Voice, DB, ML, LLM)
💾 Niveaux de Mémoire       : 2 (Session + Persistant)
⚙️ Framework Orchestration  : LangGraph4J (professionnel)
🔀 LLM Interchangeables     : 2 (Ollama, Azure)
```

---

## ✅ Checklist pour Présentation

### Avant la Présentation
- [ ] Tester les slides HTML (ouvrir dans navigateur)
- [ ] Vérifier navigation (dots, keyboard, scroll)
- [ ] Visualiser diagrammes PlantUML
- [ ] Relire talking points par pilier
- [ ] Prévoir exemples code si questions détaillées

### Pendant la Présentation
- [ ] Montrer slide 0 (Vue d'ensemble 7 piliers)
- [ ] Couvrir slides 1-7 (Détails par pilier)
- [ ] Terminer avec slide 8 (récap architecture)
- [ ] Utiliser diagrammes si questions architecture
- [ ] Montrer fichiers d'analyse pour preuves

### Après la Présentation
- [ ] Partager lien vers HTML (peut s'ouvrir offline)
- [ ] Partager documents markdown (RESUME + ANALYSE)
- [ ] Laisser diagrammes PlantUML pour référence technique

---

## 🚀 Prochaines Étapes

### Pour Améliorer la Présentation
- [ ] Ajouter plus de screenshots du code
- [ ] Enregistrer vidéo démo des agents
- [ ] Créer slides spécifiques par audience (tech vs métier)

### Pour Approfondir
- [ ] Exporter diagrammes PlantUML en PNG pour imprimer
- [ ] Créer guide utilisateur pour chaque agent
- [ ] Documentér API endpoints complet

---

## 📞 Support

- **Questions sur Architecture** → Voir `ANALYSE_7_PILIERS_AGENTIQUE.md`
- **Questions sur Couverture** → Voir `RESUME_EXECUTIF_7_PILIERS.md`
- **Questions sur Code** → Voir exemples Spring AI dans analyse
- **Questions sur Diagrammes** → Visualiser `.puml` files

---

## 📝 Notes Importantes

✅ **Tous les 7 piliers sont implémentés** (pas juste des théories)  
✅ **Architecture modulaire et extensible** (facile d'ajouter nouveaux agents)  
✅ **Production-ready** (avec CheckPointer, rate limiting, observability)  
✅ **Flexible sur LLM** (peut switcher Ollama ↔ Azure sans changement code)  

---

**Projet** : SpeakCoach — AI-Powered Pronunciation Training  
**Framework** : Spring Boot 3 + LangGraph4J + Spring AI  
**Architecture** : Agentique IA complète (7 piliers)  
**Status** : ✅ Production-Ready
