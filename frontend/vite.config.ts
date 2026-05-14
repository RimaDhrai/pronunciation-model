import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import type { UserConfig } from "vitest/config";

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
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt"],
      manifest: {
        name: "SpeakCoach AI",
        short_name: "SpeakCoach",
        description: "Coach de prononciation IA — CEFR, chatbot, exercices",
        theme_color: "#80DCDC",
        background_color: "#FEF8F3",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "src/test/**",
        "**/*.d.ts",
        "src/main.tsx",
        "vite.config.ts",
      ],
    },
  },
} as UserConfig));
