import express from "express";
import cors from "cors";
import path from "node:path";
// 🔴 si tenés router, mantené esta línea:
import routes from "./routes/index.js"; // si usás TS con "type":"module", asegurate la extensión .js al compilar

const app = express();
app.use(cors());
app.use(express.json());

// ✅ salud directa (para descartar problemas de router)
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ✅ tus rutas (si las usás)
app.use("/api", routes);

/**
 * ─── STATIC + SPA (producción) ────────────────────────────────────────────────
 * Vite debe compilar el frontend a dist/public (ver paso 2)
 * Express sirve esos estáticos y hace fallback a index.html para rutas del cliente
 */
const staticDir = path.join(process.cwd(), "dist", "public");
app.use(express.static(staticDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});
// ──────────────────────────────────────────────────────────────────────────────

// ⬇️ 0.0.0.0 para que sea accesible desde fuera (Replit/Deploy)
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`[api] listening on ${port}`);
});
