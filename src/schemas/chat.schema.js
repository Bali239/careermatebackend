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
    issue: z.string().trim().min(1).max(400).optional(),
    whyItMatters: z.string().trim().min(1).max(500).optional(),
    suggestedImprovement: z.string().trim().min(1).max(500).optional(),
    relevantSection: z.string().trim().min(1).max(120).optional(),
    requiresAdditionalInfo: z.boolean().optional(),
  })
  .passthrough();

export const analysisResponseSchema = z
  .object({
    summary: z.string().max(2000).default(''),
    atsScore: z.coerce.number().min(0).max(100).default(0),
    overallScore: z.coerce.number().min(0).max(100).nullable().optional(),
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

// Gemini's structured-output schema. Keeping this separate from the Zod
// persistence schema lets optional sections be omitted while forcing Gemini to
// use the scalar/array shapes expected by the API.
const geminiStringArray = { type: 'ARRAY', items: { type: 'STRING' } };
const geminiRecommendation = {
  type: 'OBJECT',
  properties: {
    issue: { type: 'STRING' },
    whyItMatters: { type: 'STRING' },
    suggestedImprovement: { type: 'STRING' },
    relevantSection: { type: 'STRING' },
    requiresAdditionalInfo: { type: 'BOOLEAN' },
  },
};

export const geminiAnalysisResponseSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    atsScore: { type: 'NUMBER' },
    strengths: geminiStringArray,
    gaps: geminiStringArray,
    missingSkills: geminiStringArray,
    recommendations: { type: 'ARRAY', items: geminiRecommendation },
    keywords: geminiStringArray,
    tailoredSummary: { type: 'STRING' },
    editableHtml: { type: 'STRING' },
    scoreBreakdown: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          score: { type: 'NUMBER' },
          note: { type: 'STRING' },
        },
        required: ['label', 'score', 'note'],
      },
    },
    overallJobMatch: {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        technicalSkills: { type: 'NUMBER' },
        experienceRelevance: { type: 'NUMBER' },
        educationAlignment: { type: 'NUMBER' },
        keywordCoverage: { type: 'NUMBER' },
        evidenceQuality: { type: 'NUMBER' },
        explanation: { type: 'STRING' },
        strongestAreas: geminiStringArray,
        biggestGaps: geminiStringArray,
      },
    },
    skillsComparison: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          requirement: { type: 'STRING' },
          status: { type: 'STRING' },
          importance: { type: 'STRING' },
          evidence: geminiStringArray,
          explanation: { type: 'STRING' },
          nextAction: { type: 'STRING' },
        },
        required: ['requirement', 'status', 'importance', 'evidence', 'explanation', 'nextAction'],
      },
    },
    atsReadiness: {
      type: 'OBJECT',
      properties: {
        keywordCoverage: { type: 'STRING' },
        standardHeadings: { type: 'STRING' },
        contactInformation: { type: 'STRING' },
        chronology: { type: 'STRING' },
        readability: { type: 'STRING' },
        quantifiedAchievements: { type: 'STRING' },
        technicalDocumentChecks: geminiStringArray,
        aiRecommendations: geminiStringArray,
      },
      required: [
        'keywordCoverage',
        'standardHeadings',
        'contactInformation',
        'chronology',
        'readability',
        'quantifiedAchievements',
        'technicalDocumentChecks',
        'aiRecommendations',
      ],
    },
    experienceInsights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          relevance: { type: 'STRING' },
          evidence: geminiStringArray,
          skillsDemonstrated: geminiStringArray,
          weaknesses: geminiStringArray,
          priorities: geminiStringArray,
        },
        required: [
          'title',
          'relevance',
          'evidence',
          'skillsDemonstrated',
          'weaknesses',
          'priorities',
        ],
      },
    },
    jobDescriptionBreakdown: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        seniority: { type: 'STRING' },
        responsibilities: geminiStringArray,
        requiredSkills: geminiStringArray,
        preferredSkills: geminiStringArray,
        education: geminiStringArray,
        certifications: geminiStringArray,
        experienceRequirements: geminiStringArray,
        technologies: geminiStringArray,
        softSkills: geminiStringArray,
        keywords: geminiStringArray,
        majorExpectations: geminiStringArray,
      },
      required: [
        'responsibilities',
        'requiredSkills',
        'preferredSkills',
        'education',
        'certifications',
        'experienceRequirements',
        'technologies',
        'softSkills',
        'keywords',
        'majorExpectations',
      ],
    },
  },
  required: [
    'summary',
    'atsScore',
    'strengths',
    'gaps',
    'missingSkills',
    'recommendations',
    'keywords',
    'tailoredSummary',
    'editableHtml',
    'scoreBreakdown',
  ],
};
