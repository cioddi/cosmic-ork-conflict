import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server:{allowedHosts:["servo"]},
  build: {
    outDir: "docs",
    emptyOutDir: true,
    sourcemap: true,
    // The battle is an intentionally deferred route-sized bundle; the initial
    // army builder remains far below this threshold.
    chunkSizeWarningLimit: 1250,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
