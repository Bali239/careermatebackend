import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { cleanExtractedProfile } from '../utils/profile-normalizer.js';

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const list = (value) => (Array.isArray(value) ? value.map(clean).filter(Boolean) : []);

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

export function buildTailoredCvContent({ fullName, chat, cvText = '', extractedProfile = {} }) {
  const analysis = chat?.analysis ?? {};
  const jobBreakdown = analysis.jobDescriptionBreakdown ?? {};
  const profile = cleanExtractedProfile(extractedProfile ?? {});
  const roleTitle = clean(jobBreakdown.title) || clean(chat?.title) || 'Target Role';
  // Job-description keywords guide the rewrite, but must never become claimed
  // candidate skills unless they already exist in the verified extracted profile.
  const profileSkills = list(profile.skills);
  const profileSkillKeys = new Set(profileSkills.map((skill) => skill.toLocaleLowerCase()));
  const verifiedKeywords = [
    ...list(analysis.keywords),
    ...list(jobBreakdown.requiredSkills),
    ...list(jobBreakdown.preferredSkills),
    ...list(jobBreakdown.keywords),
  ].filter((keyword) => profileSkillKeys.has(keyword.toLocaleLowerCase()));
  const skills = [...new Set([...profileSkills, ...verifiedKeywords])].slice(0, 30);
  const experience = Array.isArray(profile.experience) && profile.experience.length
    ? profile.experience.map((item) => ({
        title: clean(item.jobTitle) || 'Experience', company: clean(item.company), location: clean(item.location),
        dates: [clean(item.startDate), clean(item.endDate || (item.current ? 'Present' : ''))].filter(Boolean).join(' – '),
        description: clean(item.description), highlights: list(item.achievements),
      }))
    : [];

  return {
    fullName: clean(profile.contact?.fullName) || clean(fullName) || 'Candidate', contact: profile.contact ?? {},
    targetRole: clean(profile.headline) || roleTitle,
    professionalSummary: clean(analysis.tailoredSummary) || clean(analysis.summary) || clean(profile.summary),
    skills, experience, education: Array.isArray(profile.education) ? profile.education : [],
    certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
    projects: Array.isArray(profile.projects) ? profile.projects : [], languages: Array.isArray(profile.languages) ? profile.languages : [],
    awards: Array.isArray(profile.awards) ? profile.awards : [], interests: list(profile.interests),
    customSections: Array.isArray(profile.customSections) ? profile.customSections : [],
  };
}

function contactLine(content) {
  return [content.contact?.email, content.contact?.phone, content.contact?.location, content.contact?.linkedin, content.contact?.website].map(clean).filter(Boolean).join(' | ');
}

function renderList(items) {
  return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
}

export function renderTailoredCvHtml(content) {
  const experienceHtml = content.experience.map((item) => `<article class="experience"><div class="row"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.dates)}</span></div><div class="muted">${escapeHtml([item.company, item.location].filter(Boolean).join(' · '))}</div>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${renderList(item.highlights)}</article>`).join('');
  const simpleSection = (title, items, formatter = (item) => escapeHtml(item)) => items.length ? `<section><h2>${title}</h2>${items.map(formatter).join('')}</section>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45}.cv{width:100%;max-width:780px;margin:0 auto;padding:36px 42px}header{text-align:center;border-bottom:2px solid #172033;padding-bottom:14px;margin-bottom:18px}h1{font-size:25pt;line-height:1.1;margin:0 0 5px}header .role{font-size:12pt;font-weight:bold;color:#4f46a5}header .contact{font-size:9pt;color:#4b5563;margin-top:7px}section{margin:0 0 16px}h2{font-size:11pt;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #9ca3af;padding-bottom:4px;margin:0 0 8px;color:#172033}p{margin:0 0 6px}.skills{display:flex;flex-wrap:wrap;gap:5px 14px}.skills span:before{content:'• ';color:#4f46a5}.row{display:flex;justify-content:space-between;gap:12px}.muted{color:#4b5563;font-style:italic;margin:2px 0 4px}.experience{margin-bottom:11px}ul{margin:4px 0 0;padding-left:19px}li{margin:2px 0}</style></head><body><main class="cv"><header><h1>${escapeHtml(content.fullName)}</h1><div class="role">${escapeHtml(content.targetRole)}</div><div class="contact">${escapeHtml(contactLine(content))}</div></header>${content.professionalSummary ? `<section><h2>Professional Summary</h2><p>${escapeHtml(content.professionalSummary)}</p></section>` : ''}${content.skills.length ? `<section><h2>Core Skills</h2><div class="skills">${content.skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join('')}</div></section>` : ''}${content.experience.length ? `<section><h2>Professional Experience</h2>${experienceHtml}</section>` : ''}${simpleSection('Projects', content.projects, (item) => `<article><div class="row"><strong>${escapeHtml(clean(item.name))}</strong><span>${escapeHtml(clean(item.role))}</span></div><p>${escapeHtml(clean(item.description))}</p>${renderList(list(item.technologies))}</article>`)}${simpleSection('Education', content.education, (item) => `<article><div class="row"><strong>${escapeHtml([item.degree, item.field].filter(Boolean).map(clean).join(', '))}</strong><span>${escapeHtml([clean(item.startDate), clean(item.endDate)].filter(Boolean).join(' – '))}</span></div><div class="muted">${escapeHtml([clean(item.institution), clean(item.location)].filter(Boolean).join(' · '))}</div>${item.details ? `<p>${escapeHtml(clean(item.details))}</p>` : ''}</article>`)}${simpleSection('Certifications', content.certifications, (item) => `<p><strong>${escapeHtml(clean(item.name))}</strong>${item.issuer ? ` — ${escapeHtml(clean(item.issuer))}` : ''}</p>`)}${simpleSection('Languages', content.languages, (item) => `<p>${escapeHtml(clean(item.name))}${item.proficiency ? ` — ${escapeHtml(clean(item.proficiency))}` : ''}</p>`)}${content.interests.length ? `<section><h2>Additional Information</h2><p>${escapeHtml(content.interests.join(' · '))}</p></section>` : ''}${content.customSections.map((section) => `<section><h2>${escapeHtml(clean(section.title))}</h2>${(section.fields ?? []).map((field) => `<p><strong>${escapeHtml(clean(field.label))}:</strong> ${escapeHtml(clean(field.value))}</p>`).join('')}</section>`).join('')}</main></body></html>`;
}

function docParagraph(text, options = {}) { return new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: options.bold })] }); }

export async function createGeneratedDocumentBuffers(content) {
  const children = [new Paragraph({ text: content.fullName, heading: HeadingLevel.TITLE }), docParagraph(content.targetRole, { bold: true }), docParagraph(contactLine(content))];
  const heading = (title) => children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
  const bullets = (items) => items.forEach((item) => children.push(new Paragraph({ text: item, bullet: { level: 0 } })));
  if (content.professionalSummary) { heading('Professional Summary'); children.push(docParagraph(content.professionalSummary)); }
  if (content.skills.length) { heading('Core Skills'); children.push(docParagraph(content.skills.join(' · '))); }
  if (content.experience.length) { heading('Professional Experience'); for (const item of content.experience) { children.push(docParagraph([item.title, item.company, item.dates].filter(Boolean).join(' | '), { bold: true })); if (item.description) children.push(docParagraph(item.description)); bullets(item.highlights); } }
  if (content.projects.length) { heading('Projects'); for (const item of content.projects) { children.push(docParagraph([item.name, item.role].filter(Boolean).join(' | '), { bold: true })); children.push(docParagraph(item.description)); bullets(list(item.technologies)); } }
  if (content.education.length) { heading('Education'); for (const item of content.education) children.push(docParagraph([item.degree, item.field, item.institution, item.endDate].filter(Boolean).map(clean).join(' | '))); }
  if (content.certifications.length) { heading('Certifications'); bullets(content.certifications.map((item) => [item.name, item.issuer].filter(Boolean).map(clean).join(' — '))); }
  if (content.languages.length) { heading('Languages'); bullets(content.languages.map((item) => [item.name, item.proficiency].filter(Boolean).map(clean).join(' — '))); }
  const docx = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  const pdf = await new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 48 }); const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk)); document.on('end', () => resolve(Buffer.concat(chunks))); document.on('error', reject);
    const section = (title) => { document.moveDown(0.7).font('Helvetica-Bold').fontSize(11).text(title.toUpperCase()); document.moveDown(0.25).font('Helvetica').fontSize(9.5); };
    document.font('Helvetica-Bold').fontSize(22).text(content.fullName, { align: 'center' }); document.fontSize(11).fillColor('#4f46a5').text(content.targetRole, { align: 'center' }).fillColor('#172033'); document.font('Helvetica').fontSize(8.5).text(contactLine(content), { align: 'center' });
    if (content.professionalSummary) { section('Professional Summary'); document.text(content.professionalSummary); }
    if (content.skills.length) { section('Core Skills'); document.text(content.skills.join('  •  ')); }
    if (content.experience.length) { section('Professional Experience'); for (const item of content.experience) { document.font('Helvetica-Bold').text([item.title, item.company, item.dates].filter(Boolean).join(' | ')); document.font('Helvetica'); if (item.description) document.text(item.description); for (const bullet of item.highlights) document.text(`• ${bullet}`, { indent: 12 }); } }
    if (content.projects.length) { section('Projects'); for (const item of content.projects) { document.font('Helvetica-Bold').text([item.name, item.role].filter(Boolean).join(' | ')); document.font('Helvetica').text(item.description); } }
    if (content.education.length) { section('Education'); for (const item of content.education) document.text([item.degree, item.field, item.institution, item.endDate].filter(Boolean).map(clean).join(' | ')); }
    if (content.certifications.length) { section('Certifications'); content.certifications.forEach((item) => document.text(`• ${[item.name, item.issuer].filter(Boolean).map(clean).join(' — ')}`, { indent: 12 })); }
    if (content.languages.length) { section('Languages'); content.languages.forEach((item) => document.text(`• ${[item.name, item.proficiency].filter(Boolean).map(clean).join(' — ')}`, { indent: 12 })); }
    document.end();
  });
  return { docx: Buffer.from(docx), pdf };
}
