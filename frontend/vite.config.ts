import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import pkg from "./package.json";

// Single source of truth for the app version: the Docker release build passes
// APP_VERSION (the git tag), otherwise fall back to package.json — which is what
// local and native (Capacitor) builds use.
const APP_VERSION = process.env.APP_VERSION || pkg.version;

export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Never generate/register the service worker while running tests.
      disable: mode === "test",
      // The web app registers the SW itself (web only), see src/pwa/PwaUpdater.tsx.
      injectRegister: false,
      registerType: "prompt",
      devOptions: { enabled: false },
      manifest: {
        name: "MeleFlow",
        short_name: "MeleFlow",
        description: "Gestión de tareas autoalojada",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#FAFAFA",
        background_color: "#FAFAFA",
        categories: ["productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // `json` is required so the i18next locale files are available offline.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf,json}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        // Keep the SW out of API/uploads/websocket routes: those must always
        // reach the network (the sync engine owns the offline data story).
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/ws(\/|$)/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Keep the entry chunk small: split long-lived vendor code so it can be
    // cached independently from app code (and from lazily-loaded views).
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-i18n": [
            "i18next",
            "react-i18next",
            "i18next-browser-languagedetector",
            "i18next-http-backend",
          ],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://backend:3000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://backend:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://backend:3000",
        ws: true,
      },
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
}));
