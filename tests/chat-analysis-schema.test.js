import test from 'node:test';
import assert from 'node:assert/strict';

import { analysisResponseSchema } from '../src/schemas/chat.schema.js';

const payload = {
  summary: 'Strong product-focused engineer profile with relevant leadership exposure.',
  atsScore: 82,
  overallJobMatch: {
    score: 82,
    technicalSkills: 88,
    experienceRelevance: 79,
    educationAlignment: 74,
    keywordCoverage: 86,
    evidenceQuality: 80,
    explanation: 'The profile aligns well with the role need for shipping product features and collaborating with stakeholders.',
    strongestAreas: ['API design', 'cross-functional delivery'],
    biggestGaps: ['limited SaaS growth metrics'],
  },
  skillsComparison: [
    {
      requirement: 'React',
      status: 'matched',
      importance: 'required',
      evidence: ['Built customer-facing dashboards'],
      explanation: 'The candidate has direct frontend delivery experience.',
      nextAction: 'Highlight framework-specific delivery examples in the experience bullets.',
    },
  ],
  atsReadiness: {
    keywordCoverage: 'good',
    standardHeadings: 'present',
    contactInformation: 'complete',
    chronology: 'consistent',
    readability: 'mostly clear',
    quantifiedAchievements: 'moderately strong',
    technicalDocumentChecks: ['Standard sections present'],
    aiRecommendations: ['Add stronger metrics where available.'],
  },
  experienceInsights: [
    {
      title: 'Senior Frontend Engineer',
      relevance: 'high',
      evidence: ['Led reusable component architecture'],
      skillsDemonstrated: ['React', 'TypeScript'],
      weaknesses: ['Please add explicit business impact'],
      priorities: ['Emphasize measurable user impact'],
    },
  ],
  jobDescriptionBreakdown: {
    title: 'Senior Frontend Engineer',
    seniority: 'mid-senior',
    responsibilities: ['Ship customer-facing features'],
    requiredSkills: ['React', 'TypeScript'],
    preferredSkills: ['Next.js'],
    education: ['Bachelor degree in Computer Science'],
    certifications: [],
    experienceRequirements: ['3+ years in product engineering'],
    technologies: ['React', 'TypeScript'],
    softSkills: ['Communication'],
    keywords: ['React', 'TypeScript'],
    majorExpectations: ['Deliver customer-facing features'],
  },
  recommendations: [
    {
      issue: 'Metrics are light.',
      whyItMatters: 'The role is impact-driven.',
      suggestedImprovement: 'Add concrete business outcomes to each role bullet.',
      relevantSection: 'Experience',
      requiresAdditionalInfo: false,
    },
  ],
  strengths: ['Strong product-facing experience'],
  gaps: ['Role-specific metrics are limited'],
  missingSkills: ['SaaS growth analytics'],
  keywords: ['React', 'TypeScript', 'product'],
  tailoredSummary: 'Product-focused engineer with strong frontend delivery experience.',
  editableHtml: '<section>Example</section>',
  scoreBreakdown: [{ label: 'Role fit', score: 82, note: 'Strong alignment.' }],
};

test('analysis response schema preserves the expanded job-match structure', () => {
  const parsed = analysisResponseSchema.parse(payload);
  assert.ok(parsed.overallJobMatch);
  assert.equal(parsed.overallJobMatch.score, 82);
  assert.ok(Array.isArray(parsed.skillsComparison));
  assert.ok(parsed.atsReadiness);
  assert.ok(Array.isArray(parsed.experienceInsights));
  assert.ok(parsed.jobDescriptionBreakdown);
  assert.equal(parsed.recommendations[0].issue, 'Metrics are light.');
});
