import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import Profile from '../models/profile.model.js';
import CV from '../models/cv.model.js';
import { profileSchema } from '../schemas/profile.schema.js';
import { httpError } from '../utils/http-error.js';
import { queueUnprocessedCVs } from '../services/cv-extraction.service.js';
import { rebuildUserProfile } from '../services/profile-rebuild.service.js';
import ProfileChange from '../models/profile-change.model.js';
import ProfileChangeHistory from '../models/profile-change-history.model.js';
import { applyChanges } from '../services/profile-merge.service.js';
export const listProfileChanges = async (req, res) => {
  const changes = await ProfileChange.find({ userId: req.authUser._id, status: 'pending' })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ status: 'ok', data: changes });
};

export const getProfileChange = async (req, res) => {
  const change = await ProfileChange.findOne({
    _id: req.params.id,
    userId: req.authUser._id,
  }).lean();
  if (!change) throw httpError(404, 'Change proposal not found');
  res.json({ status: 'ok', data: change });
};

export const applyProfileChanges = async (req, res) => {
  const change = await ProfileChange.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!change) throw httpError(404, 'Change proposal not found');
  if (change.status !== 'pending') throw httpError(400, 'Change proposal already processed');

  const approved = change.changes.filter((c) => c.status === 'accepted');
  if (approved.length === 0) throw httpError(400, 'No approved changes to apply');

  const result = await applyChanges(req.authUser._id, approved, change.cvId, change._id);
  if (!result.success) throw httpError(409, result.error || 'Failed to apply changes');

  change.status = 'applied';
  change.appliedAt = new Date();
  change.completedAt = new Date();
  await change.save();

  res.json({ status: 'ok', data: { version: result.version, applied: approved.length } });
};

export const rejectProfileChanges = async (req, res) => {
  const change = await ProfileChange.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!change) throw httpError(404, 'Change proposal not found');
  if (change.status !== 'pending') throw httpError(400, 'Change proposal already processed');

  change.status = 'rejected';
  change.completedAt = new Date();
  await change.save();

  res.json({ status: 'ok', message: 'Changes rejected' });
};

export const resolveChangeItem = async (req, res) => {
  const change = await ProfileChange.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!change) throw httpError(404, 'Change proposal not found');

  const item = change.changes.id(req.params.itemId);
  if (!item) throw httpError(404, 'Change item not found');

  const { status, resolution, manualValue } = req.body;
  if (status) item.status = status;
  if (resolution) item.resolution = resolution;
  if (manualValue !== undefined) item.proposedValue = manualValue;

  await change.save();
  res.json({ status: 'ok', data: item });
};

export const getChangeHistory = async (req, res) => {
  const history = await ProfileChangeHistory.find({ userId: req.authUser._id })
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();
  res.json({ status: 'ok', data: history });
};

const emptyProfile = (user) => ({
  contact: {
    fullName: user.name ?? '',
    email: user.email ?? '',
    phone: '',
    location: '',
    website: '',
    linkedin: '',
    github: '',
  },
  headline: '',
  summary: '',
  skills: [],
  experience: [],
  education: [],
  certifications: [],
  projects: [],
  languages: [],
  awards: [],
  interests: [],
});
const responseProfile = (record, user) => {
  const base = emptyProfile(user);
  if (!record) return { ...base, lastExtractedAt: null, manuallyEdited: false, updatedAt: null };
  const result = record.toObject ? record.toObject() : record;
  return {
    ...base,
    ...result,
    id: String(result._id),
    _id: undefined,
    __v: undefined,
    manualOverrides: undefined,
    legacyProtected: undefined,
    manualOverridesInitialized: undefined,
  };
};

export const getProfile = async (req, res) => {
  await queueUnprocessedCVs(req.authUser._id);
  const [profile, recentCVs] = await Promise.all([
    Profile.findOne({ userId: req.authUser._id }),
    CV.find({ userId: req.authUser._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('name extractionStatus extractionError createdAt extractedProfile')
      .lean(),
  ]);
  res.json({
    status: 'ok',
    data: {
      profile: responseProfile(profile, req.authUser),
      extraction: recentCVs.map((cv) => ({
        id: String(cv._id),
        name: cv.name,
        status: cv.extractionStatus ?? 'failed',
        error:
          cv.extractionError || (cv.extractionStatus ? '' : 'This CV has not been processed yet.'),
        createdAt: cv.createdAt,
      })),
    },
  });
};

export const updateProfile = async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, 'Profile details are invalid');
  await rebuildUserProfile(req.authUser._id, async () => {
    const current = await Profile.findOne({ userId: req.authUser._id }).lean();
    const before = responseProfile(current, req.authUser);
    const overrides = current?.manualOverrides ?? {
      scalars: {},
      items: {},
      removedItems: {},
      customSections: [],
      removedCustomFields: [],
    };
    overrides.scalars ??= {};
    overrides.items ??= {};
    overrides.removedItems ??= {};
    overrides.customSections ??= [];
    overrides.removedCustomFields ??= [];
    const normalized = (value) =>
      String(value ?? '')
        .trim()
        .toLocaleLowerCase()
        .replace(/\s+/g, ' ');
    const scalarPaths = [
      'contact.fullName',
      'contact.email',
      'contact.phone',
      'contact.location',
      'contact.website',
      'contact.linkedin',
      'contact.github',
      'headline',
      'summary',
    ];
    const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
    for (const path of scalarPaths)
      if (getPath(before, path) !== getPath(parsed.data, path))
        overrides.scalars[path] = getPath(parsed.data, path);
    const listKeys = [
      'skills',
      'interests',
      'experience',
      'education',
      'certifications',
      'projects',
      'languages',
      'awards',
    ];
    const itemIdentity = (key, item) => {
      if (key === 'skills' || key === 'interests') return normalized(item);
      const fields = {
        experience: ['jobTitle', 'company', 'startDate'],
        education: ['institution', 'degree', 'field', 'endDate'],
        certifications: ['name', 'issuer'],
        projects: ['name'],
        languages: ['name'],
        awards: ['name', 'issuer', 'date'],
      }[key];
      return fields.map((field) => normalized(item[field])).join('|');
    };
    for (const key of listKeys) {
      overrides.items[key] ??= {};
      overrides.removedItems[key] ??= [];
      const oldItems = new Map((before[key] ?? []).map((item) => [itemIdentity(key, item), item]));
      const newItems = new Map(
        (parsed.data[key] ?? []).map((item) => [itemIdentity(key, item), item])
      );
      for (const [id, item] of newItems) {
        overrides.removedItems[key] = overrides.removedItems[key].filter(
          (removedId) => removedId !== id
        );
        if (!oldItems.has(id) || JSON.stringify(oldItems.get(id)) !== JSON.stringify(item))
          overrides.items[key][id] = item;
      }
      for (const id of oldItems.keys())
        if (!newItems.has(id)) {
          overrides.removedItems[key].push(id);
          delete overrides.items[key][id];
        }
      overrides.removedItems[key] = [...new Set(overrides.removedItems[key])];
    }
    const sectionFields = new Map();
    for (const section of parsed.data.customSections)
      for (const field of section.fields)
        sectionFields.set(`${normalized(section.title)}|${normalized(field.label)}`, {
          title: section.title,
          ...field,
        });
    const existingSections = new Map();
    for (const section of before.customSections ?? [])
      for (const field of section.fields ?? [])
        existingSections.set(`${normalized(section.title)}|${normalized(field.label)}`, {
          title: section.title,
          ...field,
        });
    overrides.customSections = [...sectionFields.values()];
    const customFieldId = (field) => `${normalized(field.title)}|${normalized(field.label)}`;
    const removedCustomFields = new Map(
      (overrides.removedCustomFields ?? []).map((field) => [customFieldId(field), field])
    );
    for (const [id, field] of existingSections)
      if (!sectionFields.has(id))
        removedCustomFields.set(id, { title: field.title, label: field.label });
    for (const id of sectionFields.keys()) removedCustomFields.delete(id);
    overrides.removedCustomFields = [...removedCustomFields.values()];
    const legacyProtected =
      current?.legacyProtected ??
      (!current?.manualOverridesInitialized && current
        ? Object.fromEntries(
            [...scalarPaths, ...listKeys, 'customSections'].map((path) => [
              path,
              getPath(current, path),
            ])
          )
        : null);
    await Profile.updateOne(
      { userId: req.authUser._id },
      {
        $set: {
          ...parsed.data,
          manualOverrides: overrides,
          legacyProtected,
          manuallyEdited: true,
          manualOverridesInitialized: true,
        },
        $setOnInsert: { userId: req.authUser._id },
      },
      { upsert: true, runValidators: true }
    );
  });
  const profile = await Profile.findOne({ userId: req.authUser._id });
  res.json({ status: 'ok', data: responseProfile(profile, req.authUser) });
};

export const deleteProfile = async (req, res) => {
  await Profile.deleteOne({ userId: req.authUser._id });
  res.json({ status: 'ok', message: 'Profile details cleared' });
};

function profileLines(profile) {
  const lines = [];
  const add = (heading, value) => {
    if (value) lines.push({ heading, value: String(value) });
  };
  add(
    'Contact',
    [
      profile.contact?.email,
      profile.contact?.phone,
      profile.contact?.location,
      profile.contact?.website,
      profile.contact?.linkedin,
      profile.contact?.github,
    ]
      .filter(Boolean)
      .join(' | ')
  );
  add('Professional Summary', profile.summary);
  add('Skills', (profile.skills ?? []).join(' · '));
  for (const item of profile.experience ?? [])
    add(
      'Experience',
      `${item.jobTitle || ''}${item.company ? ` — ${item.company}` : ''}${item.location ? `, ${item.location}` : ''}\n${[item.startDate, item.current ? 'Present' : item.endDate].filter(Boolean).join(' – ')}\n${item.description || ''}${(item.achievements ?? []).length ? `\n${item.achievements.map((x) => `• ${x}`).join('\n')}` : ''}`
    );
  for (const item of profile.education ?? [])
    add(
      'Education',
      `${item.degree || ''}${item.field ? `, ${item.field}` : ''} — ${item.institution || ''}\n${[item.startDate, item.endDate].filter(Boolean).join(' – ')}\n${item.details || ''}`
    );
  for (const item of profile.certifications ?? [])
    add(
      'Certifications',
      `${item.name || ''}${item.issuer ? ` — ${item.issuer}` : ''}${item.issueDate ? ` (${item.issueDate})` : ''}`
    );
  for (const item of profile.projects ?? [])
    add(
      'Projects',
      `${item.name || ''}${item.role ? ` — ${item.role}` : ''}\n${item.description || ''}${item.technologies?.length ? `\n${item.technologies.join(', ')}` : ''}`
    );
  for (const item of profile.languages ?? [])
    add('Languages', `${item.name || ''}${item.proficiency ? ` — ${item.proficiency}` : ''}`);
  for (const item of profile.awards ?? [])
    add(
      'Awards',
      `${item.name || ''}${item.issuer ? ` — ${item.issuer}` : ''}${item.date ? ` (${item.date})` : ''}\n${item.description || ''}`
    );
  add('Interests', (profile.interests ?? []).join(' · '));
  for (const section of profile.customSections ?? [])
    add(
      section.title,
      (section.fields ?? []).map((field) => `${field.label}: ${field.value}`).join('\n')
    );
  return lines;
}

async function getCurrentProfile(req) {
  const profile = await Profile.findOne({ userId: req.authUser._id }).lean();
  if (!profile) throw httpError(404, 'Add or extract profile details before exporting');
  return profile;
}

export const exportProfileDocx = async (req, res) => {
  const profile = await getCurrentProfile(req);
  const children = [
    new Paragraph({
      text: profile.contact?.fullName || req.authUser.name,
      heading: HeadingLevel.TITLE,
    }),
  ];
  if (profile.headline)
    children.push(new Paragraph({ text: profile.headline, heading: HeadingLevel.HEADING_2 }));
  for (const section of profileLines(profile)) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }));
    for (const line of section.value.split('\n'))
      children.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': "attachment; filename*=UTF-8''Career_Profile.docx",
  });
  res.send(buffer);
};

export const exportProfilePdf = async (req, res) => {
  const profile = await getCurrentProfile(req);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 54, bottom: 54, left: 56, right: 56 },
    info: { Title: 'Career Profile', Author: profile.contact?.fullName || req.authUser.name },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });
  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor('#252944')
    .text(profile.contact?.fullName || req.authUser.name);
  if (profile.headline)
    doc.moveDown(0.3).font('Helvetica').fontSize(12).fillColor('#6958d6').text(profile.headline);
  doc.moveDown(0.4);
  for (const section of profileLines(profile)) {
    doc
      .moveDown(0.5)
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#252944')
      .text(section.heading);
    doc
      .moveDown(0.15)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#44485d')
      .text(section.value, { lineGap: 3 });
  }
  doc.end();
  await finished;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': "attachment; filename*=UTF-8''Career_Profile.pdf",
  });
  res.send(Buffer.concat(chunks));
};
