import { z } from 'zod';

export const chatCreateSchema = z.object({
  cvId: z.string().min(1, 'Select a CV first.'),
  jobDescription: z
    .string()
    .trim()
    .min(20, 'Write a little more about the job description.')
    .max(8000),
  title: z.string().trim().max(120).optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Type a message before sending.').max(2000),
});

export const chatEditSchema = z.object({
  draftHtml: z.string().max(250000).default(''),
  isEditing: z.boolean().optional(),
});

export const analysisResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  atsScore: z.number().min(0).max(100),
  strengths: z.array(z.string().trim().min(1).max(400)).max(20),
  gaps: z.array(z.string().trim().min(1).max(400)).max(20),
  missingSkills: z.array(z.string().trim().min(1).max(200)).max(20),
  recommendations: z.array(z.string().trim().min(1).max(500)).max(20),
  keywords: z.array(z.string().trim().min(1).max(100)).max(50),
  tailoredSummary: z.string().min(1).max(3000),
  editableHtml: z.string().min(1).max(250000),
  scoreBreakdown: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        score: z.number().min(0).max(100),
        note: z.string().trim().min(1).max(500),
      })
    )
    .max(5)
    .default([]),
});
