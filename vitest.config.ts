import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/features/**/domain/*.ts",
        "src/features/catalog/application/*.ts",
        "src/features/eligibility/application/*.ts",
        "src/features/orders/application/*.ts",
        "src/features/payments/infrastructure/mercado-pago-webhook.ts"
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
    }
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
});
