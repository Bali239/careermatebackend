import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import AuthToken from '../models/auth-token.model.js';
import User from '../models/user.model.js';
import { httpError } from '../utils/http-error.js';
import {
  consumeActionToken,
  emailVerificationLink,
  hashPassword,
  invalidateUserSessions,
  issueSession,
  publicUser,
  revokeSession,
  rotateSession,
  sendPasswordReset,
  verifyPassword,
} from '../services/auth.service.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const opaque = () => randomBytes(32).toString('base64url');
const normalizedEmail = (email) => email.trim().toLowerCase();
const oauthConfigured = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI)
    throw httpError(503, 'Google sign-in is not configured');
};
const oauthStartUrl = (state) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  return url.toString();
};

export const signup = async (req, res) => {
  const email = normalizedEmail(req.body.email);
  if (await User.exists({ email }))
    throw httpError(409, 'An account with this email already exists');
  const passwordHash = await hashPassword(req.body.password);
  let user;
  try {
    user = await User.create({
      name: req.body.name.trim(),
      email,
      passwordHash,
      emailVerified: false,
    });
    await emailVerificationLink(user);
  } catch (error) {
    if (user) {
      await AuthToken.deleteMany({ userId: user._id, purpose: 'verify-email' });
      await User.deleteOne({ _id: user._id });
    }
    if (error.code === 11000) throw httpError(409, 'An account with this email already exists');
    throw error;
  }
  res
    .status(201)
    .json({
      status: 'ok',
      message: 'Account created. Check your email to verify it before signing in.',
    });
};

export const login = async (req, res) => {
  const user = await User.findOne({ email: normalizedEmail(req.body.email) }).select(
    '+passwordHash'
  );
  if (!user?.passwordHash || !(await verifyPassword(req.body.password, user.passwordHash)))
    throw httpError(401, 'Email or password is incorrect');
  if (!user.emailVerified) throw httpError(403, 'Verify your email before signing in');
  res.json({ status: 'ok', data: await issueSession(user) });
};

export const refresh = async (req, res) => {
  res.json({ status: 'ok', data: await rotateSession(req.body.refreshToken) });
};

export const logout = async (req, res) => {
  await revokeSession(req.body.refreshToken);
  res.json({ status: 'ok', message: 'Signed out' });
};

export const getCurrentUser = (req, res) =>
  res.json({ status: 'ok', data: { user: publicUser(req.authUser) } });

export const verifyEmail = async (req, res) => {
  const token = await consumeActionToken(req.body.token, 'verify-email');
  const user = await User.findByIdAndUpdate(
    token.userId,
    { $set: { emailVerified: true } },
    { new: true }
  );
  if (!user) throw httpError(400, 'This link is invalid or has expired');
  res.json({ status: 'ok', message: 'Email verified. You can now sign in.' });
};

export const resendVerificationEmail = async (req, res) => {
  const user = await User.findOne({ email: normalizedEmail(req.body.email), emailVerified: false });
  if (user) {
    try {
      await emailVerificationLink(user);
    } catch (error) {
      console.error('Verification email could not be sent:', error.message);
    }
  }
  res.json({
    status: 'ok',
    message: 'If the account needs verification, an email will be sent shortly.',
  });
};

export const forgotPassword = async (req, res) => {
  const user = await User.findOne({
    email: normalizedEmail(req.body.email),
    passwordHash: { $ne: null },
  }).select('+passwordHash');
  if (user) {
    try {
      await sendPasswordReset(user);
    } catch (error) {
      console.error('Password reset email could not be sent:', error.message);
    }
  }
  res.json({
    status: 'ok',
    message: 'If an account exists for that email, password reset instructions will be sent.',
  });
};

export const resetPassword = async (req, res) => {
  const token = await consumeActionToken(req.body.token, 'reset-password');
  const user = await User.findById(token.userId).select('+passwordHash');
  if (!user) throw httpError(400, 'This link is invalid or has expired');
  user.passwordHash = await hashPassword(req.body.password);
  await user.save();
  await invalidateUserSessions(user._id);
  res.json({ status: 'ok', message: 'Password updated. Sign in with your new password.' });
};

export const startGoogleSignIn = async (req, res) => {
  oauthConfigured();
  const state = opaque();
  await AuthToken.create({
    tokenHash: hash(state),
    purpose: 'google-state',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  res.redirect(oauthStartUrl(state));
};

export const completeGoogleSignIn = async (req, res) => {
  try {
    oauthConfigured();
    if (typeof req.query.state !== 'string' || typeof req.query.code !== 'string')
      throw httpError(400, 'Google sign-in could not be completed');
    const state = await AuthToken.findOneAndDelete({
      tokenHash: hash(req.query.state),
      purpose: 'google-state',
      expiresAt: { $gt: new Date() },
    });
    if (!state) throw httpError(400, 'Google sign-in expired. Please try again.');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw httpError(401, 'Google sign-in could not be completed');
    const googleTokens = await tokenResponse.json();
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${googleTokens.access_token}` },
    });
    if (!profileResponse.ok) throw httpError(401, 'Google sign-in could not be completed');
    const payload = await profileResponse.json();
    if (!payload?.email || !payload.verified_email || !payload.id)
      throw httpError(401, 'Google did not provide a verified email address');
    const email = normalizedEmail(payload.email);
    let user = await User.findOne({ googleId: payload.id }).select('+googleId');
    if (!user) {
      user = await User.findOne({ email }).select('+googleId');
      if (user && user.googleId && user.googleId !== payload.id)
        throw httpError(409, 'This email is already linked to another Google account');
      if (user) {
        user.googleId = payload.id;
        user.emailVerified = true;
        user.avatarUrl = payload.picture ?? user.avatarUrl;
        if (!user.name) user.name = payload.name ?? email;
        await user.save();
      } else {
        user = await User.create({
          email,
          name: payload.name ?? email,
          googleId: payload.id,
          avatarUrl: payload.picture ?? null,
          emailVerified: true,
        });
      }
    }
    const handoffCode = opaque();
    await AuthToken.create({
      tokenHash: hash(handoffCode),
      userId: user._id,
      purpose: 'google-handoff',
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    });
    res.redirect(
      `${env.CLIENT_URL}/auth/google/callback#handoff=${encodeURIComponent(handoffCode)}`
    );
  } catch (error) {
    console.error('Google sign-in callback failed:', error?.message ?? 'unknown error');
    const reason = error.statusCode === 409 ? 'account_conflict' : 'google_signin_failed';
    res.redirect(`${env.CLIENT_URL}/auth/google/callback#error=${reason}`);
  }
};

export const exchangeGoogleSignIn = async (req, res) => {
  const token = await AuthToken.findOneAndDelete({
    tokenHash: hash(req.body.handoffCode),
    purpose: 'google-handoff',
    expiresAt: { $gt: new Date() },
  });
  if (!token) throw httpError(400, 'Google sign-in link is invalid or expired');
  const user = await User.findById(token.userId);
  if (!user) throw httpError(401, 'Google sign-in could not be completed');
  res.json({ status: 'ok', data: await issueSession(user) });
};
