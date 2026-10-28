import { GeminiRequestError, geminiModels } from '../config/gemini.js';
import {
  analysisResponseSchema,
  atsReadinessSchema,
  experienceInsightSchema,
  geminiAnalysisResponseSchema,
  jobDescriptionBreakdownSchema,
  overallJobMatchSchema,
  requirementComparisonItemSchema,
  scoreBreakdownItemSchema,
} from '../schemas/chat.schema.js';

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function listHtml(items, fallback) {
  const values = (items ?? []).filter(Boolean);
  if (!values.length) return fallback;
  return `<ul style="margin: 8px 0 0 18px; padding: 0; list-style: disc; color: #1f2937;">
    ${values.map((item) => `<li style="margin-bottom: 6px; line-height: 1.5;">${escapeHtml(String(item)).replace(/\n/g, '<br />')}</li>`).join('')}
  </ul>`;
}

// Gemini sometimes returns keyword metadata objects (`{ keyword, inCv }`) even
// though the API contract and MongoDB model store keywords as string arrays.
// Normalize those responses before validating/persisting the analysis.
export function normalizeAnalysisArrays(analysis) {
  const textValue = (value) => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    for (const key of [
      'value',
      'text',
      'label',
      'name',
      'skill',
      'keyword',
      'title',
      'status',
      'assessment',
      'summary',
      'explanation',
      'description',
      'recommendation',
      'action',
      'reason',
      'score',
    ]) {
      if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
    return '';
  };
  const textArray = (value) =>
    Array.isArray(value) ? value.map(textValue).filter(Boolean) : value;
  const stringArray = (value, objectKey) =>
    Array.isArray(value)
      ? value
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object' && typeof item[objectKey] === 'string') {
              return item[objectKey].trim();
            }
            return '';
          })
          .filter(Boolean)
      : value;

  for (const field of ['strengths', 'gaps', 'missingSkills', 'keywords']) {
    analysis[field] = stringArray(analysis[field], field === 'keywords' ? 'keyword' : 'value');
  }

  if (analysis.jobDescriptionBreakdown) {
    const breakdown = analysis.jobDescriptionBreakdown;
    for (const field of [
      'responsibilities',
      'requiredSkills',
      'preferredSkills',
      'education',
      'certifications',
      'experienceRequirements',
      'technologies',
      'softSkills',
      'majorExpectations',
    ]) {
      breakdown[field] = textArray(breakdown[field]);
    }
    breakdown.keywords = stringArray(breakdown.keywords, 'keyword');
    for (const field of ['title', 'seniority']) breakdown[field] = textValue(breakdown[field]);
  }

  if (analysis.atsReadiness) {
    for (const field of [
      'keywordCoverage',
      'standardHeadings',
      'contactInformation',
      'chronology',
      'readability',
      'quantifiedAchievements',
    ]) {
      analysis.atsReadiness[field] = textValue(analysis.atsReadiness[field]);
    }
    analysis.atsReadiness.technicalDocumentChecks = textArray(
      analysis.atsReadiness.technicalDocumentChecks
    );
    analysis.atsReadiness.aiRecommendations = textArray(analysis.atsReadiness.aiRecommendations);
  }

  if (Array.isArray(analysis.skillsComparison)) {
    const statusMap = {
      matched: 'matched',
      match: 'matched',
      met: 'matched',
      present: 'matched',
      'partially matched': 'partially matched',
      partial: 'partially matched',
      missing: 'not demonstrated',
      absent: 'not demonstrated',
      unclear: 'unclear',
      unknown: 'unclear',
    };
    const importanceMap = { required: 'required', must: 'required', preferred: 'preferred', optional: 'optional' };
    analysis.skillsComparison = analysis.skillsComparison.map((item) => ({
      ...item,
      requirement: textValue(item?.requirement ?? item?.skill ?? item?.keyword),
      status: statusMap[String(item?.status ?? item?.match ?? 'unclear').toLowerCase()] ?? 'unclear',
      importance: importanceMap[String(item?.importance ?? 'optional').toLowerCase()] ?? 'optional',
      evidence: textArray(item?.evidence),
      explanation: textValue(item?.explanation ?? item?.reason),
      nextAction: textValue(item?.nextAction ?? item?.action),
    }));
  }

  if (Array.isArray(analysis.experienceInsights)) {
    analysis.experienceInsights = analysis.experienceInsights.map((item) => ({
      ...item,
      title: textValue(item?.title ?? item?.role),
      relevance: ['high', 'medium', 'low'].includes(String(item?.relevance).toLowerCase())
        ? String(item.relevance).toLowerCase()
        : 'medium',
      evidence: textArray(item?.evidence),
      skillsDemonstrated: textArray(item?.skillsDemonstrated ?? item?.skills),
      weaknesses: textArray(item?.weaknesses),
      priorities: textArray(item?.priorities),
    }));
  }

  return analysis;
}

function parseOptionalArray(schema, value, label) {
  if (value === undefined) return undefined;
  const parsed = schema.array().safeParse(value);
  if (!parsed.success) {
    console.warn(`Gemini returned invalid ${label}; omitting only that section.`);
    return undefined;
  }
  return parsed.data;
}

// Validate each expanded section independently. One malformed optional section
// must not erase valid scores, skills, or ATS data from the same Gemini response.
export function normalizeAnalysisResponse(parsed) {
  normalizeAnalysisArrays(parsed);

  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('Gemini returned an analysis without a summary. Please try again.');
  }
  if (!Number.isFinite(Number(parsed.atsScore))) {
    throw new Error('Gemini returned an analysis without a valid ATS score. Please try again.');
  }

  // Parse only the stable/base fields here. Expanded sections are validated
  // independently below so one malformed Gemini section cannot reject the
  // otherwise usable analysis.
  const core = analysisResponseSchema.parse({
    summary: parsed.summary,
    atsScore: parsed.atsScore,
    strengths: parsed.strengths,
    gaps: parsed.gaps,
    missingSkills: parsed.missingSkills,
    keywords: parsed.keywords,
    recommendations: parsed.recommendations,
    tailoredSummary: parsed.tailoredSummary,
    editableHtml: parsed.editableHtml,
  });
  for (const field of [
    'overallJobMatch',
    'skillsComparison',
    'atsReadiness',
    'experienceInsights',
    'jobDescriptionBreakdown',
    'scoreBreakdown',
  ]) {
    delete core[field];
  }

  const normalized = { ...core };
  const optionalSections = [
    ['overallJobMatch', overallJobMatchSchema],
    ['atsReadiness', atsReadinessSchema],
    ['jobDescriptionBreakdown', jobDescriptionBreakdownSchema],
  ];
  for (const [field, schema] of optionalSections) {
    if (parsed[field] === undefined) continue;
    const result = schema.safeParse(parsed[field]);
    if (result.success) normalized[field] = result.data;
    else console.warn(`Gemini returned invalid ${field}; omitting only that section.`);
  }

  const arraySections = [
    ['skillsComparison', requirementComparisonItemSchema, 'skills comparison'],
    ['experienceInsights', experienceInsightSchema, 'experience insights'],
  ];
  for (const [field, schema, label] of arraySections) {
    const value = parseOptionalArray(schema, parsed[field], label);
    if (value !== undefined) normalized[field] = value;
  }

  const scoreBreakdown = parseOptionalArray(
    scoreBreakdownItemSchema,
    parsed.scoreBreakdown,
    'score breakdown'
  );
  if (scoreBreakdown !== undefined) normalized.scoreBreakdown = scoreBreakdown;

  const scoredFields = [
    'technicalSkills',
    'experienceRelevance',
    'keywordCoverage',
    'evidenceQuality',
  ];
  if (
    normalized.overallJobMatch &&
    !scoredFields.some((field) => typeof normalized.overallJobMatch[field] === 'number')
  ) {
    delete normalized.overallJobMatch;
  }

  return normalized;
}

function buildEditableHtml(analysis) {
  const summaryText = (analysis.tailoredSummary || analysis.summary || '').trim();
  const keywords = (analysis.keywords ?? []).filter(Boolean).slice(0, 12);
  const scoreBreakdown =
    (analysis.scoreBreakdown ?? [])
      .map(({ label, score, note }) => {
        const safeLabel = escapeHtml(String(label));
        const safeNote = escapeHtml(String(note));
        return `<li style="margin-bottom: 8px;"><strong>${safeLabel}</strong> (${score}/100): ${safeNote}</li>`;
      })
      .join('') || '<li>No ATS scoring details available.</li>';

  return `
    <div style="max-width: 980px; margin: 0 auto; padding: 28px 32px; background: #ffffff; color: #111827; font-family: Arial, Helvetica, sans-serif; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="padding-bottom: 18px; border-bottom: 2px solid #cbd5e1; margin-bottom: 20px;">
        <h1 style="margin: 0 0 10px; font-size: 30px; letter-spacing: 0.04em; color: #0f172a;">Target Role CV Draft</h1>
        <p style="margin: 0; color: #475569; font-size: 15px;"><strong>ATS fit:</strong> ${Number(analysis.atsScore ?? 0)}% | <strong>Role focus:</strong> ${escapeHtml(String(analysis.summary || 'Professional role alignment'))}</p>
      </div>

      <section style="margin-bottom: 22px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #0f172a;">Professional summary</h2>
        <p style="margin: 0; font-size: 15px; color: #1f2937;">${escapeHtml(summaryText).replace(/\n/g, '<br />') || 'This profile has been tailored to the target role with emphasis on relevant experience, strong transferable skills, and role-specific impact.'}</p>
      </section>

      <section style="margin-bottom: 22px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #0f172a;">Key skills and keywords</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${keywords.length ? keywords.map((keyword) => `<span style="display: inline-block; padding: 7px 12px; border-radius: 999px; background: #e0e7ff; color: #312e81; font-size: 12px; font-weight: 700;">${escapeHtml(String(keyword))}</span>`).join('') : `<span style="color:#64748b; font-size: 14px;">No highly specific keywords were extracted from the provided job description.</span>`}
        </div>
      </section>

      <section style="margin-bottom: 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">
        <div style="padding: 16px 18px; border: 1px solid #dbeafe; border-radius: 12px; background: #f8fafc;">
          <h3 style="margin: 0 0 10px; font-size: 18px; color: #1e3a8a;">Strengths</h3>
          ${listHtml(analysis.strengths, "<p style='margin: 0; color: #64748b;'>No major strengths identified from the current CV.</p>")}
        </div>

        <div style="padding: 16px 18px; border: 1px solid #fed7aa; border-radius: 12px; background: #fff7ed;">
          <h3 style="margin: 0 0 10px; font-size: 18px; color:#9a5b00;">Gaps to improve</h3>
          ${listHtml(analysis.gaps, "<p style='margin: 0; color:#7c2d12;'>No major gaps were identified from the current CV and target description.</p>")}
        </div>
      </section>

      <section style="margin-bottom: 22px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #0f172a;">ATS scoring breakdown</h2>
        <ul style="margin: 0; padding-left: 18px; color: #334155;">
          ${scoreBreakdown}
        </ul>
      </section>

      <section style="margin-bottom: 22px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #0f172a;">Priority actions</h2>
        ${listHtml(analysis.recommendations, "<p style='margin: 0; color: #64748b;'>Keep the CV concise, quantify achievements, and align each bullet to the role requirements.</p>")}
      </section>

      <section style="margin-bottom: 8px;">
        <h2 style="margin: 0 0 10px; font-size: 22px; color: #0f172a;">Missing skills to prioritize</h2>
        ${listHtml(analysis.missingSkills, "<p style='margin: 0; color: #64748b;'>No major missing skills were flagged after comparing the CV to the job description.</p>")}
      </section>
    </div>
  `;
}

export async function analyzeCVForJobDescription(cv, jobDescription, cvText) {
  const prompt = [
    'You are an ATS-focused career advisor. Review the CV against the job description and give a structured analysis in valid JSON only.',
    'Return fields: summary, atsScore, strengths, gaps, missingSkills, recommendations, keywords, tailoredSummary, editableHtml, scoreBreakdown.',
    "scoreBreakdown must be an array of 3 to 5 objects with { label, score, note } such as 'Keyword alignment', 'Experience match', 'Leadership', 'Skills fit', 'Formatting clarity'.",
    'Each score should be a number from 0 to 100 and must be based only on explicit evidence in the CV and the supplied job description. Do not guess or use a neutral placeholder score.',
    'Make every analysis detail realistic and grounded in the CV text. Never invent experience, credentials, dates, skills, achievements, metrics, or evidence.',
    'If the CV does not contain enough evidence for a field, omit that field or return an empty array. Do not fill missing fields with generic advice, assumptions, or made-up facts.',
    'Use ATS-friendly suggestions and a short tailored summary that can be edited by the user.',
    'keywords should be the relevant job keywords that can be compared against the CV; do not claim a keyword is present unless it is supported by the CV text.',
    'Return expanded fields when the CV and job description provide enough evidence. If a section cannot be supported, omit that section rather than inventing data or generic fallback text.',
    'editableHtml must be a polished HTML resume draft for the user to edit in the browser.',
    'Also return when available: overallJobMatch { score, technicalSkills, experienceRelevance, educationAlignment, keywordCoverage, evidenceQuality, explanation, strongestAreas, biggestGaps }, skillsComparison array of { requirement, status, importance, evidence, explanation, nextAction }, experienceInsights array of { title, relevance, evidence, skillsDemonstrated, weaknesses, priorities }, jobDescriptionBreakdown { title, seniority, responsibilities, requiredSkills, preferredSkills, education, certifications, experienceRequirements, technologies, softSkills, keywords, majorExpectations }, atsReadiness { keywordCoverage, standardHeadings, contactInformation, chronology, readability, quantifiedAchievements, technicalDocumentChecks, aiRecommendations }.',
    'The response must be valid JSON and nothing else.',
  ].join('\n');

  const parts = [{ text: `JOB DESCRIPTION:\n${jobDescription.slice(0, 6000)}` }];
  const extractedText = typeof cvText === 'string' ? cvText.trim() : '';

  if (!extractedText) throw new Error('No usable CV text available for job analysis');

  parts.push({ text: `CV TEXT:\n${extractedText.slice(0, 120000)}` });

  let answer;
  let lastError;
  try {
    answer = await geminiModels.cvAnalysis.generate(prompt, parts, {
      responseSchema: geminiAnalysisResponseSchema,
    });
  } catch (error) {
    lastError = error;
    if (!(error instanceof GeminiRequestError) || !retryableStatuses.has(error.status)) throw error;
    console.warn(
      `Gemini primary model returned ${error.status}; retrying job analysis with the fallback model.`
    );
    try {
      answer = await geminiModels.cvAnalysisFallback.generate(prompt, parts, {
        responseSchema: geminiAnalysisResponseSchema,
      });
    } catch (fallbackError) {
      lastError = fallbackError;
    }
  }
  if (!answer) throw lastError ?? new Error('Gemini did not return a job-fit analysis.');

  const parsed = JSON.parse(answer);

  // Gemini can return concise strings or partial recommendation objects. Preserve only
  // information Gemini actually returned; never manufacture explanatory text or actions.
  if (Array.isArray(parsed.recommendations)) {
    parsed.recommendations = parsed.recommendations.map((item) => {
      if (typeof item === 'string') {
        const recommendation = item.trim();
        return recommendation ? { issue: recommendation } : null;
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }
      const fields = ['issue', 'whyItMatters', 'suggestedImprovement', 'relevantSection'];
      const normalizedItem = Object.fromEntries(
        fields
          .map((field) => [field, typeof item[field] === 'string' ? item[field].trim() : ''])
          .filter(([, value]) => value)
      );
      if (typeof item.requiresAdditionalInfo === 'boolean') {
        normalizedItem.requiresAdditionalInfo = item.requiresAdditionalInfo;
      }
      return Object.keys(normalizedItem).length ? normalizedItem : null;
    }).filter(Boolean);
  }

  const normalized = normalizeAnalysisResponse(parsed);

  // Compute a real overall score from the sub-metrics when available.
  // Never fall back to atsScore — that is Gemini's independent single score,
  // not a composite of job match / technical / experience / keyword / evidence.
  const om = normalized.overallJobMatch;
  const scoreParts = [
    om?.technicalSkills,
    om?.experienceRelevance,
    om?.educationAlignment,
    om?.keywordCoverage,
    om?.evidenceQuality,
  ].filter((score) => typeof score === 'number');
  if (scoreParts.length > 0) {
    const calculatedScore = Math.round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length);
    normalized.overallScore = calculatedScore;
    if (om) normalized.overallJobMatch = { ...om, score: calculatedScore };
  } else {
    normalized.overallScore = null;
    if (normalized.overallJobMatch) delete normalized.overallJobMatch.score;
  }

  return {
    ...normalized,
    editableHtml: normalized.editableHtml || buildEditableHtml(normalized),
  };
}
