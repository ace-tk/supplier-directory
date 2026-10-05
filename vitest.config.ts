import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests (currently the Pattern Print Studio geometry helpers). Run with `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { environment: "node", include: ["features/**/*.test.ts"] },
});
