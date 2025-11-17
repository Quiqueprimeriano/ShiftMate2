import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000", // backend en dev
        changeOrigin: true,
      },
    },
    // Si Replit te cambia el subdominio y te bloquea, cambiá a allowedHosts: true
    allowedHosts: [
      "14311159-0e7c-428a-a851-f6ec72431c0c-00-ozdj6xuq2oty.spock.replit.dev",
    ],
  },
  build: {
    // Compila el frontend dentro de dist/public (para que Express lo sirva en producción)
    outDir: path.resolve(__dirname, "dist/public"),
    // No vaciar dist completo (ahí vive tu server compilado)
    emptyOutDir: false,
  },
});
