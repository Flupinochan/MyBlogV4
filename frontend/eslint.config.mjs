import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "dist",
    "coverage",
    ".astro",
    "node_modules",
    "public",
    "src/types/*.generated.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,mjs}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["src/types/selectedContent.ts", "src/types/viewTransition.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginAstro.configs.recommended,
  eslintConfigPrettier,
]);
