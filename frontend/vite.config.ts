import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    hmr: { overlay: false },
    proxy: {
      // ── KEYCLOAK (Port 8090) — proxy pour éviter CORS quand accès par IP ──
      '/kc': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kc/, ''),
      },

      // ── IA (FastAPI - Port 8000) ──────────────────────────────────────────
      // IMPORTANT : les routes spécifiques doivent être AVANT /api/exercises
      '/api/exercises/progress': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Génération d'exercices & feedback → Spring Boot (Ollama)
      '/api/exercises/generate': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/exercises/feedback': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/exercises/phrases': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/exercises/revision': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/exercises/analyze': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Analyse audio (Whisper + score) → FastAPI
      '/api/exercises': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/progress': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/history': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/analyze': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/chat': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/api/dashboard': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/reports': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/metrics': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/debug': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/analyze': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/phonemes': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },

      // ── PERSISTANCE & AUTH (Spring Boot - Port 8080) ───────────────────────
      // ── CHATBOT (Spring Boot passe-plat vers FastAPI) ──────────────────────
      '/api/chatbot': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },

      '/api/spaced-repetition': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/level-test': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': { target: 'http://localhost:8080', changeOrigin: true },
      '/storage': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
