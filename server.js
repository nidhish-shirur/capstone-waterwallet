import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

import authRouter from "./server/routes/auth.js";
import societiesRouter from "./server/routes/societies.js";
import catchmentRouter from "./server/routes/catchment.js";
import roiRouter from "./server/routes/roi.js";
import mlRouter from "./server/routes/ml.js";
import advisoryRouter from "./server/routes/advisory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

if (process.env.VITE_API_URL?.includes("localhost:8000")) {
  delete process.env.VITE_API_URL;
}

app.use(cors());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json({ limit: "10mb" }));

// ---------------------------------------------------------------------------
// API Routers
// ---------------------------------------------------------------------------
app.use("/api/auth", authRouter);
app.use("/api/societies", societiesRouter);
app.use("/api/catchment", catchmentRouter);
app.use("/api/roi", roiRouter);
app.use("/api/ml", mlRouter);
app.use("/api/advisory", advisoryRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "WaterWallet API" });
});

// ---------------------------------------------------------------------------
// Vite Dev Server / Static Production Server
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
} else {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      host: "0.0.0.0",
      port: 3000,
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`WaterWallet server running at http://0.0.0.0:${PORT}`);
});
