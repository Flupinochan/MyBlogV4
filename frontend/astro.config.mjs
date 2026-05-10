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
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
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
