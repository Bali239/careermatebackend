import { Router } from "express";
import rateLimit from "express-rate-limit";
import { exchangeSchema, forgotSchema, loginSchema, refreshSchema, resetSchema, signupSchema, tokenSchema } from "../schemas/auth.schema.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { completeGoogleSignIn, exchangeGoogleSignIn, forgotPassword, getCurrentUser, login, logout, refresh, resendVerificationEmail, resetPassword, signup, startGoogleSignIn, verifyEmail } from "../controllers/auth.controller.js";

const router = Router();
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/signup", credentialLimiter, validate(signupSchema), signup);
router.post("/login", credentialLimiter, validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);
router.post("/logout", validate(refreshSchema), logout);
router.get("/me", requireAuth, getCurrentUser);
router.post("/verify-email", validate(tokenSchema), verifyEmail);
router.post("/verify-email/resend", credentialLimiter, validate(forgotSchema), resendVerificationEmail);
router.post("/forgot-password", credentialLimiter, validate(forgotSchema), forgotPassword);
router.post("/reset-password", credentialLimiter, validate(resetSchema), resetPassword);
router.get("/google", startGoogleSignIn);
router.get("/google/callback", completeGoogleSignIn);
router.post("/google/exchange", validate(exchangeSchema), exchangeGoogleSignIn);

export default router;
