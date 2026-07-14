// Express server for PHC Virtual Solid Filler on Azure App Service.
// Serves the built SPA (dist/) and a small REST API for the custom ingredient
// library ("Save to library" feature in the Nutrition Calculator).
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createIngredientStore } from "./store.js";
import { validateIngredientPayload } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const PORT = process.env.PORT || 8080;

const app = express();

// Azure App Service / any reverse proxy sits in front of us — trust the first hop so
// rate limiting and logging see the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

const store = await createIngredientStore();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/ingredients", async (_req, res) => {
  try {
    const rows = await store.list();
    res.json(rows);
  } catch (err) {
    console.error("GET /api/ingredients failed:", err);
    res.status(500).json({ error: "Failed to load the ingredient library." });
  }
});

// Adding/removing ingredients are the only mutating endpoints — rate limit them against abuse.
const mutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/ingredients", mutateLimiter, async (req, res) => {
  const result = validateIngredientPayload(req.body);
  if (!result.ok) {
    res.status(400).json({ error: "Invalid ingredient.", details: result.errors });
    return;
  }
  try {
    const stored = await store.add(result.value);
    res.status(201).json(stored);
  } catch (err) {
    console.error("POST /api/ingredients failed:", err);
    res.status(500).json({ error: "Failed to save the ingredient." });
  }
});

// UUID v4-shaped ids only — both stores generate ids with randomUUID(), so anything else
// can never be a real row and is rejected before touching the store.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.delete("/api/ingredients/:id", mutateLimiter, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ error: "Invalid ingredient id." });
    return;
  }
  try {
    const removed = await store.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Ingredient not found." });
      return;
    }
    res.status(204).end();
  } catch (err) {
    console.error("DELETE /api/ingredients/:id failed:", err);
    res.status(500).json({ error: "Failed to delete the ingredient." });
  }
});


// Static SPA build + client-side routing fallback (skip /api/* so unknown API routes 404 properly).
app.use(express.static(distDir));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`PHC Virtual Solid Filler listening on port ${PORT}`);
});
