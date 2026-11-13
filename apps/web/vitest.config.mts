import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // tsconfig has jsx: "preserve" for Next; component tests need JSX compiled.
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "node", include: ["lib/**/*.test.ts", "components/**/*.test.{ts,tsx}"] },
});
