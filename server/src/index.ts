import express from "express";
import cors from "cors";
// 🔴 si tenés router, mantené esta línea:
import routes from "./routes/index";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ salud directa (para descartar problemas de router)
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ✅ tus rutas (si las usás)
app.use("/api", routes);

// ⬇️ MUY IMPORTANTE: 0.0.0.0 para que se vea desde fuera
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`[api] listening on ${port}`);
});
