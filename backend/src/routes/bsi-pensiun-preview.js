import { Router } from "express";
import { comparePensionScenarios, MODEL_VERSION, PensionInputError } from "../engines/bsi-pensiun-preview.js";

// Auth and central-admin role checks are mounted by server.js before this router.
// Never enabled in production: approval, persistence and PDF integration remain gated.
export function createPensionPreviewRouter({
  enabled = process.env.BSI_PENSIUN_PREVIEW === "true",
  production = process.env.NODE_ENV === "production"
} = {}) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled || production) return res.status(404).json({ detail: "Modul validasi BSI Pensiun belum diaktifkan." });
    next();
  });
  router.get("/status", (req, res) => res.json({
    enabled: true, status: "VALIDATION_ONLY", model_version: MODEL_VERSION,
    supported_schemes: ["reguler", "atribusi_premi"], can_submit: false
  }));
  router.post("/compare", (req, res, next) => {
    try {
      res.json(comparePensionScenarios(req.body));
    } catch (error) {
      if (error instanceof PensionInputError) return res.status(400).json({ detail: error.message, field: error.field });
      next(error);
    }
  });
  return router;
}
