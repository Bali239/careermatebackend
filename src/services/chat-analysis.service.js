import { env } from "../config/env.js";
import { analysisResponseSchema } from "../schemas/chat.schema.js";

class GeminiRequestError extends Error {
  constructor(status) {
    super(`Gemini analysis failed (${status}).`);
    this.status = status;
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function generateContent(model, parts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      if (attempt === 2) throw new Error("Gemini could not be reached after multiple attempts.", { cause: error });
      await wait(800 * (2 ** attempt) + Math.floor(Math.random() * 400));
      continue;
    }

    if (response.ok) return response.json();
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw new GeminiRequestError(response.status);

    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 800 * (2 ** attempt) + Math.floor(Math.random() * 400);
    await wait(delay);
  }

  throw new Error("Gemini analysis request failed.");
}

function buildEditableHtml(analysis) {
  const sections = [
    `<h2>Tailored summary</h2><p>${analysis.tailoredSummary.replace(/\n/g, "<br />")}</p>`,
    `<h2>Core strengths</h2><ul>${(analysis.strengths ?? []).map((item) => `<li>${item}</li>`).join("") || "<li>No major strengths identified.</li>"}</ul>`,
    `<h2>Gaps and missing skills</h2><ul>${(analysis.gaps ?? []).map((item) => `<li>${item}</li>`).join("") || "<li>None identified from the supplied CV and JD.</li>"}</ul>`,
    `<h2>Recommendations</h2><ul>${(analysis.recommendations ?? []).map((item) => `<li>${item}</li>`).join("") || "<li>Keep the CV concise and aligned to the role requirements.</li>"}</ul>`,
  ];
  return `<div>${sections.join("")}</div>`;
}

export async function analyzeCVForJobDescription(cv, jobDescription, cvText) {
  if (!env.GEMINI_API_KEY) throw new Error("CV job analysis is unavailable because GEMINI_API_KEY is not configured.");

  const prompt = [
    "You are an ATS-focused career advisor. Review the CV against the job description and give a structured analysis in valid JSON only.",
    "Return fields: summary, atsScore, strengths, gaps, missingSkills, recommendations, keywords, tailoredSummary, editableHtml.",
    "Make the analysis realistic, grounded in the CV text, and never invent experience or credentials.",
    "Use ATS-friendly suggestions and a short tailored summary that can be edited by the user.",
    "keywords should be the most relevant job keywords from the description that are or should be reflected in the CV.",
    "editableHtml must be a polished HTML resume draft for the user to edit in the browser.",
    "The response must be valid JSON and nothing else."
  ].join("\n");

  const parts = [{ text: prompt }, { text: `JOB DESCRIPTION:\n${jobDescription.slice(0, 6000)}` }];
  const extractedText = typeof cvText === "string" ? cvText.trim() : "";

  if (extractedText) {
    parts.push({ text: `CV TEXT:\n${extractedText.slice(0, 120000)}` });
  } else if (cv?.data && cv.contentType) {
    parts.push({ inline_data: { mime_type: cv.contentType, data: cv.data.toString("base64") } });
  }

  const payload = await generateContent("gemini-3.6-flash", parts);

  const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!answer) throw new Error("Gemini did not return a job-fit analysis.");

  const parsed = JSON.parse(answer);
  const normalized = analysisResponseSchema.parse(parsed);

  return {
    ...normalized,
    editableHtml: normalized.editableHtml || buildEditableHtml(normalized),
  };
}
