import { Router } from "express";
import { calculateDemand } from "../services/demandEngine.js";
import { optionalAuthenticateToken } from "./auth.js";

const router = Router();

// In-memory societies store
export const societies = new Map();
let nextSocietyId = 3;
const analysisStore = new Map();

// Seed initial demo societies for user 1 & 2
societies.set(1, {
  id: 1,
  name: "Gokuldham Co-operative Housing Society",
  pincode: "400601",
  num_flats: 48,
  occupants: 168,
  roof_surface_type: "concrete",
  user_id: 1,
  created_at: new Date().toISOString(),
  billing_entries: [
    { id: 1, society_id: 1, year: 2025, month: 1, municipal_bill: 14200, tankers: 16, cost_per_tanker: 1500, tanker_capacity_l: 10000 },
    { id: 2, society_id: 1, year: 2025, month: 2, municipal_bill: 14500, tankers: 18, cost_per_tanker: 1500, tanker_capacity_l: 10000 },
    { id: 3, society_id: 1, year: 2025, month: 3, municipal_bill: 15800, tankers: 22, cost_per_tanker: 1500, tanker_capacity_l: 10000 },
  ],
});

societies.set(2, {
  id: 2,
  name: "Thane Green Valley Society",
  pincode: "400607",
  num_flats: 60,
  occupants: 210,
  roof_surface_type: "concrete",
  user_id: 2,
  created_at: new Date().toISOString(),
  billing_entries: [],
});

// POST /api/societies/baseline
router.post("/baseline", (req, res) => {
  try {
    const result = calculateDemand(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ detail: err.message });
  }
});

// POST /api/societies/
router.post("/", optionalAuthenticateToken, (req, res) => {
  const { name, pincode, num_flats, occupants, roof_surface_type } = req.body;
  const id = nextSocietyId++;
  const userId = req.user?.id || 1;
  const society = {
    id,
    name: name || "New Society",
    pincode: pincode || "400601",
    num_flats: Number(num_flats) || 40,
    occupants: occupants ? Number(occupants) : undefined,
    roof_surface_type: roof_surface_type || "concrete",
    user_id: userId,
    created_at: new Date().toISOString(),
    billing_entries: [],
  };
  societies.set(id, society);
  res.status(201).json(society);
});

// GET /api/societies/
router.get("/", optionalAuthenticateToken, (req, res) => {
  const userId = req.user?.id || 1;
  const userSocieties = Array.from(societies.values()).filter(
    (s) => s.user_id === userId || req.user?.isGuest
  );
  res.json(userSocieties.length > 0 ? userSocieties : Array.from(societies.values()).slice(0, 1));
});

// GET /api/societies/database
router.get("/database", optionalAuthenticateToken, (req, res) => {
  const userId = req.user?.id || 1;
  const userSocieties = Array.from(societies.values()).filter(
    (s) => s.user_id === userId || req.user?.isGuest
  );
  res.json(userSocieties.length > 0 ? userSocieties : Array.from(societies.values()).slice(0, 1));
});

// GET /api/societies/:id
router.get("/:id", optionalAuthenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const society = societies.get(id) || societies.get(1);
  if (!society) {
    return res.status(404).json({ detail: "Society not found" });
  }
  res.json({
    ...society,
    billing_entries: society.billing_entries || [],
    analyses: [],
  });
});

// GET /api/societies/:id/database
router.get("/:id/database", optionalAuthenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const society = societies.get(id) || societies.get(1);
  if (!society) {
    return res.status(404).json({ detail: "Society not found in database" });
  }
  res.json({
    ...society,
    billing_entries: society.billing_entries || [],
    analyses: [],
  });
});

// GET /api/societies/:id/billing
router.get("/:id/billing", optionalAuthenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const society = societies.get(id) || societies.get(1);
  if (!society) {
    return res.status(404).json({ detail: "Society not found in database" });
  }
  res.json(society.billing_entries || []);
});

// PUT /api/societies/:id
router.put("/:id", optionalAuthenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const society = societies.get(id);
  if (!society) {
    return res.status(404).json({ detail: "Society not found" });
  }
  Object.assign(society, req.body);
  res.json(society);
});

// POST /api/societies/:id/billing
router.post("/:id/billing", optionalAuthenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const society = societies.get(id);
  if (!society) {
    return res.status(404).json({ detail: "Society not found" });
  }
  const payload = Array.isArray(req.body) ? req.body : [];
  const entries = payload.map((e, i) => ({
    id: i + 1,
    society_id: id,
    ...e,
  }));
  society.billing_entries = entries;
  res.json(entries);
});

// POST /api/societies/:id/analyses
router.post("/:id/analyses", optionalAuthenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const analysis = {
    id: 1,
    society_id: id,
    ...req.body,
    created_at: new Date().toISOString(),
  };
  analysisStore.set(id, analysis);
  res.status(201).json(analysis);
});

// GET /api/societies/:id/analyses/latest
router.get("/:id/analyses/latest", optionalAuthenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const analysis = analysisStore.get(id);
  if (!analysis) {
    return res.status(404).json({ detail: "Analysis not found" });
  }
  res.json(analysis);
});

export default router;
