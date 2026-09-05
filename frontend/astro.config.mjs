// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://www.metalmental.net",
  integrations: [react()],
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
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
