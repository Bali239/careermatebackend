import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { deleteProfile, exportProfileDocx, exportProfilePdf, getProfile, updateProfile } from "../controllers/profile.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", getProfile);
router.put("/", updateProfile);
router.delete("/", deleteProfile);
router.get("/export.docx", exportProfileDocx);
router.get("/export.pdf", exportProfilePdf);

export default router;
