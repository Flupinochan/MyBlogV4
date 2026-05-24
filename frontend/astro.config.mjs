// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
    // Connect to the backend go gin server
    server: {
      proxy: {
        // voiceはs3上にあるため直接dev環境にアクセス
        "/voice": {
          target: "https://dev-blog.metalmental.net",
          changeOrigin: true,
        },
        "/voicevox-api": {
          target: "http://localhost:8081",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/voicevox-api/, ""),
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
