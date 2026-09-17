import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The SAM 2 segmentation service (services/segmentation/) is a Python
    // project, not TypeScript/JS — its virtual environment vendors
    // incidental .mjs files (e.g. inside PyTorch's bundled tooling) that
    // ESLint would otherwise try to lint as project source.
    "services/segmentation/.venv/**",
    "services/segmentation/checkpoints/**",
  ]),
]);

export default eslintConfig;
