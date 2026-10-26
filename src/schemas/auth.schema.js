import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const tokenSchema = z.object({ token: z.string().min(32) });
export const forgotSchema = z.object({ email: z.string().email().max(254) });
export const resetSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(10).max(128),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(32) });
export const exchangeSchema = z.object({ handoffCode: z.string().min(32) });
