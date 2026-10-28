import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

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

export async function createGeneratedDocumentBuffers(content) {
  const sections = [
    new Paragraph({ text: content.fullName || 'Candidate', heading: HeadingLevel.TITLE }),
    new Paragraph({ text: content.targetRole || 'Target Role', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(content.professionalSummary || ''),
    new Paragraph({ text: 'Core Skills', heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ children: [new TextRun((content.skills ?? []).join(', '))] }),
    new Paragraph({ text: 'Relevant Experience', heading: HeadingLevel.HEADING_2 }),
  ];

  for (const item of content.experience ?? []) {
    sections.push(new Paragraph({ text: item.title || 'Experience', heading: HeadingLevel.HEADING_3 }));
    for (const detail of item.details ?? []) sections.push(new Paragraph(`• ${detail}`));
    for (const highlight of item.highlights ?? []) sections.push(new Paragraph(`• ${highlight}`));
  }

  const docx = await Packer.toBuffer(new Document({ sections: [{ children: sections }] }));
  const pdf = await new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.fontSize(22).text(content.fullName || 'Candidate');
    document.moveDown(0.25).fontSize(14).text(content.targetRole || 'Target Role');
    document.moveDown().fontSize(16).text('Professional Summary');
    document.moveDown(0.25).fontSize(10).text(content.professionalSummary || '');
    document.moveDown().fontSize(16).text('Core Skills');
    document.moveDown(0.25).fontSize(10).text((content.skills ?? []).join(', '));
    document.moveDown().fontSize(16).text('Relevant Experience');
    for (const item of content.experience ?? []) {
      document.moveDown(0.25).fontSize(12).text(item.title || 'Experience');
      document.fontSize(10);
      for (const detail of item.details ?? []) document.text(`• ${detail}`);
      for (const highlight of item.highlights ?? []) document.text(`• ${highlight}`);
    }
    document.end();
  });

  return { docx: Buffer.from(docx), pdf };
}
