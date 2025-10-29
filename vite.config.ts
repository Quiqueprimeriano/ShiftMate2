import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"), // ✅ corregido
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        // ⚠️ localhost no funciona en Replit → usar 0.0.0.0
        target: "http://0.0.0.0:3000",
        changeOrigin: true,
      },
    },
    allowedHosts: [
      "14311159-0e7c-428a-a851-f6ec72431c0c-00-ozdj6xuq2oty.spock.replit.dev",
    ],
  },
});
