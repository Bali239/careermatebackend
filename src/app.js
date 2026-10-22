import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { httpError } from "./utils/http-error.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import cvRoutes from "./routes/cv.routes.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json({ limit: "1mb" }));
app.use(express.raw({ type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cvs", cvRoutes);
// Keep the original OAuth callback URL working for Google clients already
// configured with /api/auth/google/callback. New setups should use /api/v1.
app.use("/api/auth", authRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
