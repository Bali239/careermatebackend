import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const storageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'generated-cvs'
);

function sanitizeFilename(value = 'tailored-cv') {
  const safe = String(value)
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return safe || 'tailored-cv';
}

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
  const paragraphs = [
    new Paragraph({
      text: content.fullName,
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: content.targetRole,
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: content.professionalSummary,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Core Skills',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: content.skills.map((skill) => new TextRun({ text: `${skill} `, break: 1 })),
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: 'Relevant Experience',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 80 },
    }),
  ];

  for (const item of content.experience ?? []) {
    paragraphs.push(
      new Paragraph({
        text: item.title,
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 40 },
      })
    );
    for (const detail of item.details ?? []) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: detail })] }));
    }
    for (const highlight of item.highlights ?? []) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `• ${highlight}` })] }));
    }
  }

  const docxBuffer = await Packer.toBuffer(
    new Document({
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: paragraphs,
      }],
    })
  );

  const pdfDoc = new PDFDocument({
    size: 'A4',
    margins: { top: 54, bottom: 54, left: 56, right: 56 },
    info: { Title: content.targetRole, Author: content.fullName },
  });

  const pdfChunks = [];
  pdfDoc.on('data', (chunk) => pdfChunks.push(chunk));
  await new Promise((resolve, reject) => {
    pdfDoc.on('end', resolve);
    pdfDoc.on('error', reject);

    pdfDoc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#1f2937')
      .text(content.fullName);
    pdfDoc.moveDown(0.4).font('Helvetica').fontSize(12).fillColor('#4f46e5').text(content.targetRole);
    pdfDoc.moveDown(0.6).font('Helvetica').fontSize(11).fillColor('#374151').text(content.professionalSummary, {
      align: 'left',
      width: 460,
    });
    pdfDoc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Core Skills');
    pdfDoc.moveDown(0.2).font('Helvetica').fontSize(10).fillColor('#374151').text(content.skills.join(' • '));

    for (const item of content.experience ?? []) {
      pdfDoc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(item.title);
      for (const detail of item.details ?? []) {
        pdfDoc.moveDown(0.15).font('Helvetica').fontSize(10).fillColor('#374151').text(detail, { width: 460 });
      }
      for (const highlight of item.highlights ?? []) {
        pdfDoc.moveDown(0.12).font('Helvetica').fontSize(10).fillColor('#374151').text(`• ${highlight}`, { width: 460 });
      }
    }

    pdfDoc.end();
  });

  return { docx: Buffer.from(docxBuffer), pdf: Buffer.concat(pdfChunks) };
}

export async function writeGeneratedCvToDisk({ userId, chatId, versionId, docxBuffer, pdfBuffer }) {
  const userDir = path.resolve(storageRoot, String(userId));
  const chatDir = path.resolve(userDir, String(chatId));
  const versionDir = path.resolve(chatDir, String(versionId));
  await fs.mkdir(versionDir, { recursive: true });

  const docxFileName = `tailored-cv-${sanitizeFilename(String(versionId))}.docx`;
  const pdfFileName = `tailored-cv-${sanitizeFilename(String(versionId))}.pdf`;

  const docxPath = path.join(versionDir, docxFileName);
  const pdfPath = path.join(versionDir, pdfFileName);

  await fs.writeFile(docxPath, Buffer.from(docxBuffer));
  await fs.writeFile(pdfPath, Buffer.from(pdfBuffer));

  return {
    docxFileName,
    pdfFileName,
    docxRef: path.relative(storageRoot, docxPath).split(path.sep).join('/'),
    pdfRef: path.relative(storageRoot, pdfPath).split(path.sep).join('/'),
  };
}

export function resolveGeneratedCvFileRef(userId, chatId, versionId, format) {
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeChatId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeVersionId = String(versionId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFormat = format === 'pdf' ? 'pdf' : 'docx';

  return path.resolve(storageRoot, safeUserId, safeChatId, safeVersionId, `tailored-cv-${safeVersionId}.${safeFormat}`);
}

export async function readGeneratedCvFile(filePath) {
  const root = path.resolve(storageRoot);
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(root)) {
    throw new Error('Invalid generated CV file path.');
  }
  return fs.readFile(resolvedPath);
}
