import { Router } from "express";
import { generateWaterAdvisory } from "../services/advisoryEngine.js";

const router = Router();

// POST /api/advisory/water
router.post("/water", async (req, res) => {
  try {
    const advisory = await generateWaterAdvisory(req.body);
    res.json(advisory);
  } catch {
    res.status(502).json({
      detail: "The AI advisory service did not return a valid advisory. Please try again.",
    });
  }
});

export default router;
