function extractSkillTokens(text = '') {
  const tokens = new Set();
  const matches = (text.match(/\b[A-Za-z][A-Za-z0-9+.#/-]{2,}\b/g) ?? []).map((value) =>
    value.replace(/\.$/, '')
  );
  for (const match of matches) {
    const upper = match.toLowerCase();
    if (
      ['the', 'with', 'from', 'that', 'this', 'have', 'been', 'using', 'years', 'role'].includes(
        upper
      )
    )
      continue;
    tokens.add(match);
  }
  return [...tokens].slice(0, 12);
}

export function buildTailoredCvContent({ fullName, chat, cvText = '' }) {
  const analysis = chat?.analysis ?? {};
  const jobBreakdown = analysis.jobDescriptionBreakdown ?? {};
  const roleTitle = jobBreakdown.title || chat?.title || 'Target Role';
  const professionalSummary =
    analysis.tailoredSummary ||
    analysis.summary ||
    'Career-focused professional with experience aligned to the target role and a focus on measurable outcomes.';

  const keywords = [...new Set([...(analysis.keywords ?? []), ...(jobBreakdown.requiredSkills ?? []), ...(jobBreakdown.preferredSkills ?? []), ...(jobBreakdown.keywords ?? [])])].slice(0, 12);
  const extractedSkills = extractSkillTokens(cvText || '').filter((skill) =>
    skill.length > 2 && !/\d/.test(skill)
  );
  const skills = [...new Set([...keywords, ...extractedSkills])].slice(0, 14);

  const experience = [
    {
      title: roleTitle,
      details: [
        `Targeted for: ${chat?.jobDescription || 'the supplied job description'}`,
        `Original evidence reviewed: ${cvText ? cvText.slice(0, 600).replace(/\s+/g, ' ').trim() : 'CV content available in the source document.'}`,
      ],
      highlights: [...(analysis.strengths ?? []), ...(analysis.gaps ?? [])].slice(0, 5),
    },
  ];

  return {
    fullName: fullName?.trim() || 'Candidate',
    targetRole: roleTitle,
    professionalSummary,
    skills,
    keywords,
    strengths: analysis.strengths ?? [],
    gaps: analysis.gaps ?? [],
    experience,
    sectionOrder: ['Professional Summary', 'Core Skills', 'Relevant Experience', 'Priority improvements'],
  };
}
