package com.example.prononciationtest.service;

import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Curated phrase dataset — fallback when Ollama hallucinates or produces text in the
 * wrong language (qwen2.5 occasionally slips into Chinese/Arabic/English under load).
 * Organised by language × CEFR level × use-case type.
 *
 * Used by OllamaService.generatePhrase / generateBattlePhrase / generateLevelTestPhrase
 * and by ExerciseAiController for revision + phonetic phrase generation.
 */
@Component
public class PhraseTaxonomy {

    private static final Map<String, List<String>> PHRASES = new HashMap<>();
    private static final Random RNG = new Random();

    // ── French Phrases Arrays ────────────────────────────────────────────────

    private static final String[] FR_A1_G = {
        "Je mange une pomme chaque matin.",
        "Il fait beau aujourd'hui.",
        "J'habite à Paris avec ma famille.",
        "Le chat dort sur le canapé.",
        "Je bois du café le matin.",
        "Elle s'appelle Marie.",
        "Nous allons à l'école chaque jour.",
        "Mon père travaille en ville.",
        "J'aime la pizza et les pâtes.",
        "Il y a un parc près de chez moi.",
        "Le lundi, je vais au marché.",
        "Tu parles français très bien.",
        "Ma mère cuisine très bien.",
        "Je lis un livre le soir.",
        "Nous regardons la télévision ensemble."
    };

    private static final String[] FR_A2_G = {
        "Le week-end, j'aime me promener dans le parc.",
        "J'ai commandé un café et un croissant au bar.",
        "Mon frère travaille dans un hôpital depuis deux ans.",
        "Nous avons visité le musée du Louvre hier matin.",
        "Elle prend le train tous les jours pour aller travailler.",
        "Pouvez-vous me dire où se trouve la gare, s'il vous plaît?",
        "Je cherche un appartement proche du centre-ville.",
        "Il pleut souvent en automne dans cette région.",
        "Mes parents habitent à Lyon depuis trente ans.",
        "Le marché du dimanche est très animé et coloré.",
        "Tu peux m'aider à trouver une bonne boulangerie?",
        "J'ai besoin d'acheter des médicaments à la pharmacie.",
        "La réunion commence à neuf heures du matin.",
        "Nous partons en vacances à la mer cet été.",
        "Elle a appris à conduire quand elle avait dix-huit ans."
    };

    private static final String[] FR_B1_G = {
        "Les nouvelles technologies transforment notre façon de travailler au quotidien.",
        "Il est important de prendre soin de sa santé mentale et physique.",
        "J'ai décidé de changer de carrière pour suivre ma passion.",
        "La cuisine française est reconnue dans le monde entier pour sa richesse.",
        "Nous devons trouver un équilibre entre vie professionnelle et personnelle.",
        "Les réseaux sociaux ont profondément modifié nos habitudes de communication.",
        "Elle a obtenu son diplôme après quatre années d'études intensives.",
        "Le tourisme durable est devenu une priorité pour de nombreux pays.",
        "J'apprends à gérer mon stress grâce à la méditation quotidienne.",
        "La lecture régulière améliore significativement le vocabulaire et la concentration.",
        "Mon collègue a proposé une solution innovante lors de la réunion.",
        "Les transports en commun réduisent la pollution dans les grandes villes.",
        "Elle voyage souvent pour découvrir de nouvelles cultures et traditions.",
        "Il faut beaucoup de patience pour apprendre une nouvelle langue correctement.",
        "La pandémie a accéléré la transformation numérique de nombreuses entreprises."
    };

    private static final String[] FR_B2_G = {
        "L'intelligence artificielle soulève des questions éthiques fondamentales sur la vie privée.",
        "La transition énergétique nécessite une coopération internationale sans précédent.",
        "Les inégalités sociales persistent malgré les politiques publiques ambitieuses.",
        "L'apprentissage des langues étrangères développe l'empathie interculturelle.",
        "La digitalisation bouleverse les modèles économiques traditionnels dans tous les secteurs.",
        "Il est essentiel d'encourager la pensée critique chez les jeunes générations.",
        "La mondialisation a des effets contrastés sur les économies locales.",
        "Les chercheurs ont découvert un traitement prometteur contre cette maladie rare.",
        "La diversité culturelle représente une richesse pour notre société contemporaine.",
        "L'accès à l'éducation reste inégal dans de nombreuses régions du monde.",
        "Elle a su convaincre ses interlocuteurs grâce à des arguments solides et nuancés.",
        "Le changement climatique représente un défi majeur pour les générations futures.",
        "Les politiques migratoires font l'objet de vifs débats dans l'espace public.",
        "La littérature contemporaine reflète les tensions de notre époque avec acuité.",
        "Comprendre les mécanismes économiques aide à prendre des décisions éclairées."
    };

    private static final String[] FR_C1_G = {
        "L'essor de l'intelligence artificielle interpelle les fondements mêmes de notre rapport au savoir.",
        "La rhétorique politique contemporaine s'appuie abondamment sur les biais cognitifs des citoyens.",
        "La philosophie du langage interroge la capacité des mots à saisir la complexité du réel.",
        "Les mutations technologiques reconfigurent les rapports de force dans l'économie mondiale.",
        "L'épistémologie questionne les conditions de validité de tout discours scientifique.",
        "L'hégémonie culturelle se manifeste subtilement à travers les pratiques médiatiques quotidiennes.",
        "La décarbonation de l'industrie exige une refonte profonde des chaînes de valeur globales.",
        "Le plurilinguisme constitue un atout cognitif démontré par de nombreuses études récentes.",
        "L'analyse des données massives transforme radicalement les approches diagnostiques en médecine.",
        "La cohésion sociale dépend d'une redistribution équitable des fruits de la croissance économique."
    };

    private static final String[] FR_C2_G = {
        "L'intersubjectivité constitue le fondement irréductible de toute expérience phénoménologique.",
        "La dialectique hégélienne subsume les contradictions dans une synthèse perpétuellement provisoire.",
        "L'herméneutique gadamérienne postule une fusion des horizons comme condition de la compréhension.",
        "L'économie comportementale remet en cause l'axiome de rationalité de l'homo œconomicus classique.",
        "La déconstruction derridéenne interroge la prétendue neutralité des catégories conceptuelles héritées.",
        "L'épistémè foucaldienne révèle les conditions historiques de possibilité de tout discours de vérité.",
        "Le principe de subsidiarité organise la répartition des compétences entre niveaux de gouvernance.",
        "La métacognition optimise significativement les stratégies d'acquisition dans les apprentissages complexes.",
        "L'asymétrie d'information génère des inefficiences systémiques dans les marchés imparfaitement régulés.",
        "La transversalité disciplinaire est désormais reconnue comme condition nécessaire de l'innovation."
    };

    // ── English Phrases Arrays ───────────────────────────────────────────────

    private static final String[] EN_A1_G = {
        "I eat breakfast every morning.",
        "The weather is nice today.",
        "My name is Alex and I live here.",
        "I like pizza and pasta.",
        "She has a cat and a dog.",
        "We go to school every day.",
        "My father works in the city.",
        "I drink coffee in the morning.",
        "There is a park near my house.",
        "He reads books every night.",
        "They live in a small town.",
        "I have two brothers and one sister.",
        "The bus comes at eight o'clock.",
        "She works at the supermarket.",
        "Today is Monday and it is sunny."
    };

    private static final String[] EN_A2_G = {
        "On weekends, I enjoy walking in the park.",
        "I ordered a coffee and a croissant at the café.",
        "My brother has worked at the hospital for two years.",
        "We visited the museum yesterday morning.",
        "She takes the train every day to go to work.",
        "Could you tell me where the station is, please?",
        "I am looking for an apartment near the city center.",
        "It rains a lot in autumn in this region.",
        "My parents have lived in London for thirty years.",
        "The Sunday market is very busy and colorful.",
        "Can you help me find a good bakery nearby?",
        "I need to buy some medicine at the pharmacy.",
        "The meeting starts at nine o'clock in the morning.",
        "We are going on holiday to the seaside this summer.",
        "She learned to drive when she was eighteen years old."
    };

    private static final String[] EN_B1_G = {
        "New technologies are transforming the way we work on a daily basis.",
        "It is important to take care of both your mental and physical health.",
        "I decided to change careers in order to follow my passion.",
        "French cuisine is recognised around the world for its richness.",
        "We need to find a balance between our professional and personal lives.",
        "Social media has deeply changed the way we communicate with each other.",
        "She graduated after four years of intensive study.",
        "Sustainable tourism has become a priority for many countries worldwide.",
        "I am learning to manage my stress through daily meditation practice.",
        "Regular reading significantly improves vocabulary and concentration skills.",
        "My colleague proposed an innovative solution during the meeting.",
        "Public transport reduces pollution in major cities around the world.",
        "She often travels to discover new cultures and traditions.",
        "It takes a lot of patience to learn a new language properly.",
        "The pandemic accelerated the digital transformation of many businesses."
    };

    private static final String[] EN_B2_G = {
        "Artificial intelligence raises fundamental ethical questions about privacy.",
        "The energy transition requires unprecedented international cooperation.",
        "Social inequalities persist despite ambitious public policies.",
        "Learning foreign languages develops intercultural empathy.",
        "Digitalisation is disrupting traditional business models across all sectors.",
        "It is essential to encourage critical thinking in younger generations.",
        "Globalisation has contrasting effects on local economies worldwide.",
        "Researchers have discovered a promising treatment for this rare disease.",
        "Cultural diversity represents an asset for our contemporary society.",
        "Access to education remains unequal in many regions of the world.",
        "She managed to convince her audience through solid and nuanced arguments.",
        "Climate change represents a major challenge for future generations.",
        "Migration policies are the subject of heated debates in the public sphere.",
        "Contemporary literature reflects the tensions of our era with great acuity.",
        "Understanding economic mechanisms helps people make informed decisions."
    };

    private static final String[] EN_C1_G = {
        "The rise of artificial intelligence challenges the very foundations of our relationship with knowledge.",
        "Contemporary political rhetoric draws heavily on the cognitive biases of citizens.",
        "The philosophy of language questions the capacity of words to capture the complexity of reality.",
        "Technological mutations are reconfiguring power relations in the global economy.",
        "Epistemology examines the conditions of validity of any scientific discourse.",
        "Cultural hegemony manifests itself subtly through everyday media practices.",
        "The decarbonisation of industry requires a profound restructuring of global value chains.",
        "Multilingualism is a proven cognitive asset demonstrated by numerous recent studies.",
        "Big data analytics is radically transforming diagnostic approaches in modern medicine.",
        "Social cohesion depends on an equitable redistribution of economic growth benefits."
    };

    private static final String[] EN_C2_G = {
        "Intersubjectivity constitutes the irreducible foundation of any phenomenological experience.",
        "Hegelian dialectics subsumes contradictions into a perpetually provisional synthesis.",
        "Gadamerian hermeneutics postulates a fusion of horizons as the condition of understanding.",
        "Behavioural economics challenges the rationality axiom of classical homo economicus.",
        "Derridean deconstruction interrogates the alleged neutrality of inherited conceptual categories.",
        "Foucault's episteme reveals the historical conditions of possibility of any discourse on truth.",
        "The subsidiarity principle organises the distribution of competences across governance levels.",
        "Metacognition significantly optimises acquisition strategies in complex learning environments.",
        "Information asymmetry generates systemic inefficiencies in imperfectly regulated markets.",
        "Disciplinary transversality is now recognised as a necessary condition for genuine innovation."
    };

    static {
        // Populate French General
        add("fr", "A1", "general", FR_A1_G);
        add("fr", "A2", "general", FR_A2_G);
        add("fr", "B1", "general", FR_B1_G);
        add("fr", "B2", "general", FR_B2_G);
        add("fr", "C1", "general", FR_C1_G);
        add("fr", "C2", "general", FR_C2_G);

        // Populate French Battle (referencing FR_*_G arrays where identical)
        add("fr", "A1", "battle",
            FR_A1_G[0],
            "Il fait beau aujourd'hui en ville.",
            "Mon chat s'appelle Minou.",
            "J'aime le café chaud le matin.",
            "Nous habitons près du parc."
        );
        add("fr", "A2", "battle",
            FR_A2_G[0],
            FR_A2_G[1],
            FR_A2_G[4],
            FR_A2_G[3],
            FR_A2_G[7]
        );
        add("fr", "B1", "battle",
            FR_B1_G[0],
            FR_B1_G[1],
            FR_B1_G[3],
            FR_B1_G[8],
            FR_B1_G[11]
        );
        add("fr", "B2", "battle",
            "L'intelligence artificielle soulève des questions éthiques fondamentales.",
            "La transition énergétique nécessite une coopération internationale.",
            "La diversité culturelle représente une richesse pour notre société.",
            "Le changement climatique représente un défi majeur pour nos générations.",
            "Les chercheurs ont découvert un traitement prometteur contre cette maladie."
        );
        add("fr", "C1", "battle",
            "L'essor de l'intelligence artificielle interpelle les fondements de notre rapport au savoir.",
            "La rhétorique politique s'appuie abondamment sur les biais cognitifs des citoyens.",
            "Les mutations technologiques reconfigurent les rapports de force dans l'économie mondiale.",
            "Le plurilinguisme constitue un atout cognitif démontré par de nombreuses études.",
            "La cohésion sociale dépend d'une redistribution équitable des fruits de la croissance."
        );
        add("fr", "C2", "battle",
            "L'intersubjectivité constitue le fondement de toute expérience phénoménologique authentique.",
            "La dialectique hégélienne subsume les contradictions dans une synthèse toujours provisoire.",
            "L'herméneutique gadamérienne postule une fusion des horizons pour la compréhension mutuelle.",
            "L'économie comportementale remet en cause l'axiome de rationalité classique.",
            "La métacognition optimise considérablement les stratégies d'acquisition complexes."
        );

        // Populate French Revision
        add("fr", "A1", "revision",
            "Je mange une pomme et une poire chaque matin.",
            "Il fait très beau aujourd'hui dans le jardin.",
            "Mon chat noir dort sur le grand canapé.",
            "J'aime boire du café chaud avec du lait.",
            "Nous habitons près du parc et du marché."
        );
        add("fr", "A2", "revision",
            "Le week-end, j'aime me promener dans le grand parc.",
            "J'ai commandé un café et un croissant frais au bar.",
            "Elle prend le bus tous les matins pour aller au bureau.",
            "Nous avons visité un beau musée pendant nos vacances.",
            "Il pleut souvent le soir en automne dans notre ville."
        );
        add("fr", "B1", "revision",
            "Les nouvelles technologies transforment notre façon de travailler chaque jour.",
            "Il est essentiel de prendre soin de sa santé mentale et de son bien-être.",
            FR_B1_G[9],
            "Mon collègue a présenté une solution innovante lors de la réunion d'équipe.",
            "Les transports en commun réduisent considérablement la pollution dans nos villes."
        );
        add("fr", "B2", "revision",
            "L'intelligence artificielle transforme profondément nos sociétés et nos modes de vie.",
            "La transition énergétique exige des investissements massifs dans les énergies renouvelables.",
            "La diversité culturelle représente une richesse indéniable pour notre société contemporaine.",
            "Le changement climatique exige une action collective urgente à l'échelle mondiale.",
            "Les chercheurs développent des traitements innovants pour lutter contre les maladies rares."
        );
        add("fr", "C1", "revision",
            "L'essor de l'intelligence artificielle remet en question les fondements de notre rapport au savoir.",
            "La rhétorique politique contemporaine exploite habilement les biais cognitifs collectifs.",
            "Le plurilinguisme représente un atout cognitif majeur démontré par de récentes études scientifiques.",
            "La cohésion sociale suppose une redistribution juste et équitable des richesses produites.",
            "L'analyse des données massives révolutionne les pratiques diagnostiques en médecine moderne."
        );
        add("fr", "C2", "revision",
            FR_C2_G[0],
            FR_C2_G[1],
            "L'économie comportementale remet en cause l'axiome de rationalité de l'homo œconomicus.",
            "La métacognition optimise significativement les stratégies d'acquisition dans les apprentissages.",
            "L'asymétrie d'information génère des inefficiences systémiques dans les marchés régulés."
        );

        // Populate English General
        add("en", "A1", "general", EN_A1_G);
        add("en", "A2", "general", EN_A2_G);
        add("en", "B1", "general", EN_B1_G);
        add("en", "B2", "general", EN_B2_G);
        add("en", "C1", "general", EN_C1_G);
        add("en", "C2", "general", EN_C2_G);

        // Populate English Battle
        add("en", "A1", "battle",
            EN_A1_G[0],
            "The weather is very nice today.",
            "My cat sleeps on the sofa.",
            "I like coffee and chocolate.",
            "We live near the park."
        );
        add("en", "A2", "battle",
            EN_A2_G[0],
            EN_A2_G[4],
            EN_A2_G[3],
            EN_A2_G[7],
            EN_A2_G[6]
        );
        add("en", "B1", "battle",
            "New technologies are transforming the way we work every day.",
            "It is important to take care of your mental and physical health.",
            "Sustainable tourism has become a priority for many countries.",
            "Regular reading significantly improves your vocabulary and concentration.",
            "Public transport reduces pollution in major cities worldwide."
        );
        add("en", "B2", "battle",
            EN_B2_G[0],
            EN_B2_G[1],
            "Cultural diversity represents a real asset for our contemporary society.",
            EN_B2_G[11],
            EN_B2_G[7]
        );
        add("en", "C1", "battle",
            "The rise of artificial intelligence challenges the foundations of our knowledge.",
            "Contemporary political rhetoric exploits the cognitive biases of citizens.",
            EN_C1_G[3],
            "Multilingualism is a proven cognitive asset confirmed by numerous studies.",
            "Social cohesion depends on an equitable redistribution of economic benefits."
        );
        add("en", "C2", "battle",
            "Intersubjectivity constitutes the irreducible foundation of all phenomenological experience.",
            EN_C2_G[1],
            EN_C2_G[3],
            "Metacognition significantly optimises acquisition strategies in complex environments.",
            EN_C2_G[8]
        );

        // Populate English Revision
        add("en", "A1", "revision",
            "I eat an apple and drink coffee every morning.",
            "The weather is warm and sunny in the park today.",
            "My big black cat always sleeps on the sofa.",
            "I like drinking hot coffee with milk in winter.",
            "We live very close to the park and the market."
        );
        add("en", "A2", "revision",
            "On weekends, I really enjoy walking in the local park.",
            "She takes the commuter train every morning to go to work.",
            "We visited a fantastic museum during our trip last year.",
            "It often rains in the evenings during autumn in this region.",
            "I am searching for a cozy apartment close to the city center."
        );
        add("en", "B1", "revision",
            "New technologies are constantly transforming the way we work on a daily basis.",
            "It is crucial to take care of both your mental health and physical well-being.",
            "Regular reading significantly improves your vocabulary, focus, and concentration.",
            "My colleague suggested a highly innovative solution during our team meeting.",
            "Public transport reduces urban pollution significantly in cities around the world."
        );
        add("en", "B2", "revision",
            "Artificial intelligence is raising critical ethical questions about data privacy.",
            "The energy transition demands a level of international cooperation never seen before.",
            "Cultural diversity is widely recognised as a valuable asset for modern societies.",
            "Climate change poses an existential threat and requires urgent coordinated action.",
            "Researchers are developing innovative treatments to tackle rare and complex diseases."
        );
        add("en", "C1", "revision",
            "The rapid rise of artificial intelligence is profoundly challenging our existing knowledge frameworks.",
            "Contemporary political discourse exploits deeply ingrained cognitive biases among the electorate.",
            "Multilingualism is consistently demonstrated as a significant cognitive asset by recent research.",
            "Social cohesion fundamentally depends on equitable redistribution of economic growth outcomes.",
            "Big data analytics is radically reshaping diagnostic paradigms across modern medical practice."
        );
        add("en", "C2", "revision",
            "Intersubjectivity constitutes the irreducible phenomenological foundation of shared human experience.",
            "Hegelian dialectics continuously subsumes contradictions into an ever-provisional synthetic totality.",
            "Gadamerian hermeneutics posits that understanding emerges through a productive fusion of horizons.",
            "Metacognition substantially optimises knowledge acquisition strategies in highly complex learning tasks.",
            "Information asymmetry systematically generates structural inefficiencies in imperfectly regulated markets."
        );
    }

    private static void add(String lang, String level, String type, String... phrases) {
        PHRASES.computeIfAbsent(lang + "_" + level + "_" + type, k -> new ArrayList<>())
               .addAll(Arrays.asList(phrases));
    }

    // ── Public API ────────────────────────────────────────────────────────────────

    /**
     * Detects Ollama hallucinations: wrong language, non-target Unicode, meta-commentary,
     * markdown/JSON bleed-through, or content that is too short to be a real phrase.
     */
    public boolean isHallucination(String text, String expectedLang) {
        if (text == null || text.isBlank() || text.length() < 6) return true;
        if (hasNonLatinCharacters(text)) return true;

        String lower = text.toLowerCase(Locale.ROOT);
        if (containsMetaCommentary(lower)) return true;
        if (containsTechnicalJargon(lower)) return true;
        return isWrongLanguageStarter(lower, expectedLang);
    }

    private boolean hasNonLatinCharacters(String text) {
        return text.matches(".*[\\u4E00-\\u9FFF\\u0600-\\u06FF\\u0400-\\u04FF\\u0590-\\u05FF\\u0E00-\\u0E7F]+.*");
    }

    private boolean containsMetaCommentary(String lower) {
        for (String pat : List.of(
                "language model", "i am an ai", "je suis une ia",
                "voici une phrase", "here is a sentence", "here's a sentence",
                "as requested", "bien sûr", "certainly,", "of course,", "sure,",
                "```", "json", "provide", "context for", "based on", "note:")) {
            if (lower.contains(pat)) return true;
        }
        return false;
    }

    private boolean containsTechnicalJargon(String lower) {
        for (String tech : List.of(
                "algorithme", "intelligence artificielle", "digitalisation", "numérisation",
                "pandémie", "épistémologie", "rhétorique", "hégémonie", "décarbonation",
                "intersubjectivité", "herméneutique", "dialectique", "déconstruction",
                "métacognition", "subsidiarité", "transversalité", "phénoménolog",
                "homo œconomicus", "epistème", "cognitive bias", "metacognition",
                "epistemology", "hegemony", "decarbonisation", "intersubjectivity",
                "hermeneutics", "subsidiarity", "behaviourial", "behavioral economics",
                "phenomenolog", "dialectic", "deconstruct")) {
            if (lower.contains(tech)) return true;
        }
        return false;
    }

    private boolean isWrongLanguageStarter(String lower, String expectedLang) {
        if ("fr".equals(expectedLang)) {
            return lower.startsWith("the ") || lower.startsWith("i ") || lower.startsWith("we ")
                    || lower.startsWith("she ") || lower.startsWith("he ") || lower.startsWith("they ");
        }
        if ("en".equals(expectedLang)) {
            return lower.startsWith("le ") || lower.startsWith("la ") || lower.startsWith("les ")
                    || lower.startsWith("je ") || lower.startsWith("nous ") || lower.startsWith("elle ")
                    || lower.startsWith("il ") || lower.startsWith("ils ");
        }
        return false;
    }

    /**
     * Returns a random fallback phrase for the given lang / level / type.
     * Cascades: requested type → "general" type → B1/general → hard-coded default.
     */
    public String getFallback(String lang, String level, String type) {
        String l  = "en".equals(lang) ? "en" : "fr";
        String lv = normalize(level);
        String tp = type != null ? type : "general";

        List<String> list = PHRASES.get(l + "_" + lv + "_" + tp);
        if (empty(list)) list = PHRASES.get(l + "_" + lv + "_general");
        if (empty(list)) list = PHRASES.get(l + "_B1_general");
        if (empty(list)) return "fr".equals(l)
                ? "La pratique régulière est la clé du succès."
                : "Regular practice is the key to success.";

        return list.get(RNG.nextInt(list.size()));
    }

    /** Convenience shortcut for battle phrases. */
    public String getBattleFallback(String lang, String level) {
        return getFallback(lang, level, "battle");
    }

    /** Returns all curated phrases for a bucket (unmodifiable). */
    public List<String> getAll(String lang, String level, String type) {
        String key = ("en".equals(lang) ? "en" : "fr") + "_" + normalize(level) + "_" + (type != null ? type : "general");
        return Collections.unmodifiableList(PHRASES.getOrDefault(key, List.of()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private static String normalize(String level) {
        if (level == null) return "B1";
        String up = level.toUpperCase(Locale.ROOT);
        return List.of("A1","A2","B1","B2","C1","C2").contains(up) ? up : "B1";
    }

    private static boolean empty(List<?> list) {
        return list == null || list.isEmpty();
    }
}
