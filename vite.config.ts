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
    // Permitir conexiones desde cualquier host (para testing móvil)
    allowedHosts: true,
  },
  build: {
    // Compila el frontend dentro de dist/public (para que Express lo sirva en producción)
    outDir: path.resolve(__dirname, "dist/public"),
    // No vaciar dist completo (ahí vive tu server compilado)
    emptyOutDir: false,
  },
});
