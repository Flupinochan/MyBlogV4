// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  site: "https://www.metalmental.net",
  compressHTML: true,
  integrations: [
    react(),
    AstroPWA({
      registerType: "autoUpdate",
      injectRegister: null,
      manifest: {
        name: "MetalMental Portfolio",
        short_name: "MetalMental",
        description:
          "Full-Stack & SRE EngineerのMetalMentalによるポートフォリオサイトです。経歴、スキル、資格、ブログ記事を掲載しています。",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        lang: "ja",
        dir: "ltr",
        theme_color: "#8E51FF",
        background_color: "#0F172A",
        icons: [
          { src: "/image-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
          { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html}"],
        globIgnores: ["**/*.map", "serviceWorker.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/opensearch-api\//, /^\/voicevox-api\//, /^\/voice\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/gltf.glb",
            handler: "CacheFirst",
            options: {
              cacheName: "avatar-model",
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:png|gif|avif|webp|jpe?g|ico|svg)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "static-images",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
    build: {
      sourcemap: true,
    },
    // Connect to the backend go gin server
    server: {
      proxy: {
        "/voicevox-api": {
          target: "http://localhost:8081",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/voicevox-api/, ""),
        },
        // voiceはs3上にあるため直接dev環境にアクセス
        // voicevoxとvoice両方マッチする可能性があるため注意
        // 長いパスの方は上に定義
        "/voice": {
          target: "https://dev-blog.metalmental.net",
          changeOrigin: true,
        },
        "/opensearch-api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/opensearch-api/, ""),
        },
      },
    },
  },
  env: {
    schema: {
      GITHUB_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: false,
      }),
    },
  },
});
