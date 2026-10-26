import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { deleteCV, downloadCV, extractCV, listCVs, uploadCV } from "../controllers/cv.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", listCVs);
router.post("/", uploadCV);
router.post("/:id/extract", extractCV);
router.get("/:id/file", downloadCV);
router.delete("/:id", deleteCV);

export default router;
