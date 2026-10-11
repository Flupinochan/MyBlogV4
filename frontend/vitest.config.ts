import { getViteConfig } from "astro/config";
import "vitest/config";

export default getViteConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
