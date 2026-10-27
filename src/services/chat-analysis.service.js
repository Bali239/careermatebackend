import { geminiModels } from '../config/gemini.js';
import { analysisResponseSchema } from '../schemas/chat.schema.js';

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
    'Each score should be a number from 0 to 100 and the note should explain why the score was assigned without making unsupported claims.',
    'Make the analysis realistic, grounded in the CV text, and never invent experience or credentials.',
    'Use ATS-friendly suggestions and a short tailored summary that can be edited by the user.',
    'keywords should be the most relevant job keywords from the description that are or should be reflected in the CV.',
    'editableHtml must be a polished HTML resume draft for the user to edit in the browser.',
    'The response must be valid JSON and nothing else.',
  ].join('\n');

  const parts = [{ text: `JOB DESCRIPTION:\n${jobDescription.slice(0, 6000)}` }];
  const extractedText = typeof cvText === 'string' ? cvText.trim() : '';

  if (!extractedText) throw new Error('No usable CV text available for job analysis');

  parts.push({ text: `CV TEXT:\n${extractedText.slice(0, 120000)}` });

  const answer = await geminiModels.cvAnalysis.generate(prompt, parts);
  if (!answer) throw new Error('Gemini did not return a job-fit analysis.');

  const parsed = JSON.parse(answer);
  const normalized = analysisResponseSchema.parse(parsed);

  return {
    ...normalized,
    editableHtml: normalized.editableHtml || buildEditableHtml(normalized),
  };
}
