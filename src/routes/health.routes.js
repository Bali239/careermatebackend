import { Router } from "express";
import { env } from "../config/env.js";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-career-assistant-api",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;
