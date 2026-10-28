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

export const scoreBreakdownItemSchema = z.object({
  label: z.string().trim().min(1).max(80),
  score: z.number().min(0).max(100),
  note: z.string().trim().min(1).max(500),
});

export const overallJobMatchSchema = z.object({
  score: z.number().min(0).max(100),
  technicalSkills: z.number().min(0).max(100).optional(),
  experienceRelevance: z.number().min(0).max(100).optional(),
  educationAlignment: z.number().min(0).max(100).optional(),
  keywordCoverage: z.number().min(0).max(100).optional(),
  evidenceQuality: z.number().min(0).max(100).optional(),
  explanation: z.string().trim().min(1).max(1000).optional(),
  strongestAreas: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  biggestGaps: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
});

export const requirementComparisonItemSchema = z.object({
  requirement: z.string().trim().min(1).max(200),
  status: z.enum(['matched', 'partially matched', 'not demonstrated', 'unclear']),
  importance: z.enum(['required', 'preferred', 'optional']),
  evidence: z.array(z.string().trim().min(1).max(400)).max(10).default([]),
  explanation: z.string().trim().min(1).max(600),
  nextAction: z.string().trim().min(1).max(400),
});

export const atsReadinessSchema = z.object({
  keywordCoverage: z.string().trim().min(1).max(200),
  standardHeadings: z.string().trim().min(1).max(200),
  contactInformation: z.string().trim().min(1).max(200),
  chronology: z.string().trim().min(1).max(200),
  readability: z.string().trim().min(1).max(200),
  quantifiedAchievements: z.string().trim().min(1).max(200),
  technicalDocumentChecks: z.array(z.string().trim().min(1).max(250)).max(20).default([]),
  aiRecommendations: z.array(z.string().trim().min(1).max(250)).max(20).default([]),
});

export const experienceInsightSchema = z.object({
  title: z.string().trim().min(1).max(200),
  relevance: z.enum(['high', 'medium', 'low']).default('medium'),
  evidence: z.array(z.string().trim().min(1).max(400)).max(10).default([]),
  skillsDemonstrated: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  weaknesses: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  priorities: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});

export const jobDescriptionBreakdownSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  seniority: z.string().trim().min(1).max(120).optional(),
  responsibilities: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  requiredSkills: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  preferredSkills: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  education: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  certifications: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  experienceRequirements: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  technologies: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  softSkills: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  keywords: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  majorExpectations: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
});

export const recommendationSchema = z
  .object({
    issue: z.string().trim().max(400).default(''),
    whyItMatters: z.string().trim().max(500).default(''),
    suggestedImprovement: z.string().trim().max(500).default(''),
    relevantSection: z.string().trim().max(120).default(''),
    requiresAdditionalInfo: z.boolean().default(false),
  })
  .passthrough();

export const analysisResponseSchema = z
  .object({
    summary: z.string().max(2000).default(''),
    atsScore: z.coerce.number().min(0).max(100).default(0),
    overallScore: z.coerce.number().min(0).max(100).default(0),
    overallJobMatch: overallJobMatchSchema.optional(),
    skillsComparison: z.array(requirementComparisonItemSchema).max(30).default([]),
    atsReadiness: atsReadinessSchema.optional(),
    experienceInsights: z.array(experienceInsightSchema).max(20).default([]),
    jobDescriptionBreakdown: jobDescriptionBreakdownSchema.optional(),
    recommendations: z.array(recommendationSchema).max(20).default([]),
    strengths: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
    gaps: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
    missingSkills: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    keywords: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    tailoredSummary: z.string().max(3000).default(''),
    editableHtml: z.string().max(250000).default(''),
    scoreBreakdown: z.array(scoreBreakdownItemSchema).max(5).default([]),
  })
  .passthrough();
