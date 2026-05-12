import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/~oauth/],
        // Exclude HTML from precache so the shell is always fetched fresh from network
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2,wasm}"],
        // The zstd wasm bundle is ~250 KB; bump the default 2 MiB limit so it's precached.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: null,
        runtimeCaching: [
          {
            // Always try network first for navigations (HTML) — falls back to cache only if offline
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-shell",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // JS/CSS: stale-while-revalidate so updates roll in next nav without breaking offline
            urlPattern: ({ request }) =>
              request.destination === "script" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "assets",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      manifest: {
        name: "أداة تعريب زيلدا",
        short_name: "تعريب زيلدا",
        description: "أداة لتعريب ملفات لعبة زيلدا تلقائياً",
        theme_color: "#0f2617",
        background_color: "#0f2617",
        display: "standalone",
        dir: "rtl",
        lang: "ar",
        orientation: "portrait",
        icons: [
          {
            src: "pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
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
}));
