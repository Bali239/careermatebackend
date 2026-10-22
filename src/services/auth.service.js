import { createHash, randomBytes } from "node:crypto";
import { signAccessToken } from "../utils/access-token.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { env } from "../config/env.js";
import AuthSession from "../models/auth-session.model.js";
import AuthToken from "../models/auth-token.model.js";
import User from "../models/user.model.js";
import { sendAuthEmail } from "./gmail.service.js";
import { httpError } from "../utils/http-error.js";

const REFRESH_DAYS = 30;
const ACCESS_TTL_SECONDS = 15 * 60;
const hashToken = (value) => createHash("sha256").update(value).digest("hex");
const opaqueToken = () => randomBytes(32).toString("base64url");
const safeUser = (user) => ({ id: String(user._id), name: user.name, email: user.email, emailVerified: user.emailVerified, avatarUrl: user.avatarUrl ?? null });

export async function issueSession(user) {
  const refreshToken = opaqueToken();
  const session = await AuthSession.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
  });
  const accessToken = signAccessToken({ sub: String(user._id), sid: String(session._id) }, ACCESS_TTL_SECONDS);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, user: safeUser(user) };
}

export async function rotateSession(refreshToken) {
  if (typeof refreshToken !== "string" || refreshToken.length < 32) throw httpError(401, "Session is invalid or expired");
  const session = await AuthSession.findOneAndUpdate(
    { refreshTokenHash: hashToken(refreshToken), expiresAt: { $gt: new Date() }, $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }] },
    { $set: { revokedAt: new Date() } },
    { new: false },
  );
  if (!session) throw httpError(401, "Session is invalid or expired");
  const user = await User.findById(session.userId);
  if (!user) throw httpError(401, "Session is invalid or expired");
  return issueSession(user);
}

export async function revokeSession(refreshToken) {
  if (typeof refreshToken !== "string" || refreshToken.length < 32) return;
  await AuthSession.updateOne({ refreshTokenHash: hashToken(refreshToken), $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }] }, { $set: { revokedAt: new Date() } });
}

export async function createActionToken(userId, purpose, lifetimeMs) {
  const token = opaqueToken();
  await AuthToken.create({ tokenHash: hashToken(token), userId, purpose, expiresAt: new Date(Date.now() + lifetimeMs) });
  return token;
}

export async function consumeActionToken(token, purpose) {
  if (typeof token !== "string" || token.length < 32) throw httpError(400, "This link is invalid or has expired");
  const record = await AuthToken.findOneAndDelete({ tokenHash: hashToken(token), purpose, expiresAt: { $gt: new Date() } });
  if (!record) throw httpError(400, "This link is invalid or has expired");
  return record;
}

export async function emailVerificationLink(user) {
  const token = await createActionToken(user._id, "verify-email", 24 * 60 * 60 * 1000);
  const url = `${env.CLIENT_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
  await sendAuthEmail({ to: user.email, subject: "Verify your CareerMate email", heading: "Welcome to CareerMate", message: "Confirm your email address to activate your account.", button: "Verify email", url, expires: "24 hours" });
}

export async function sendPasswordReset(user) {
  const token = await createActionToken(user._id, "reset-password", 60 * 60 * 1000);
  const url = `${env.CLIENT_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
  await sendAuthEmail({ to: user.email, subject: "Reset your CareerMate password", heading: "Reset your password", message: "Use this link to choose a new password. If you did not request this, you can ignore this email.", button: "Reset password", url, expires: "1 hour" });
}

export async function invalidateUserSessions(userId) {
  await AuthSession.updateMany({ userId, $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }] }, { $set: { revokedAt: new Date() } });
}

export function publicUser(user) { return safeUser(user); }
export { hashPassword, verifyPassword };
