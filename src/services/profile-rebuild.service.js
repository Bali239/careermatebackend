import CV from '../models/cv.model.js';
import Profile from '../models/profile.model.js';
import { emptyProfile } from '../utils/profile-normalizer.js';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const norm = (value) =>
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
const identity = (key, item) => {
  if (key === 'skills' || key === 'interests') return norm(item);
  const parts = {
    experience: [item.jobTitle, item.company, item.startDate],
    education: [item.institution, item.degree, item.field, item.endDate],
    certifications: [item.name, item.issuer],
    projects: [item.name],
    languages: [item.name],
    awards: [item.name, item.issuer, item.date],
  }[key] ?? [JSON.stringify(item)];
  return parts.map(norm).join('|');
};
const pathSet = (target, path, value) => {
  const parts = path.split('.');
  const leaf = parts.pop();
  const owner = parts.reduce((object, key) => (object[key] ??= {}), target);
  owner[leaf] = value;
};
const pathGet = (target, path) => path.split('.').reduce((object, key) => object?.[key], target);
const stable = (value) => JSON.stringify(value);
const sectionKey = (title) => norm(title);

export async function rebuildUserProfile(userId, beforeRebuild, options = {}) {
  const { sourceCvId, replaceFromSource = false } = options;
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;
  const lockCollection = Profile.db.collection('profile_rebuild_locks');
  try {
    await lockCollection.updateOne(
      { _id: userId },
      { $setOnInsert: { dirty: false } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  let acquired = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const now = new Date();
    await lockCollection.updateOne(
      {
        _id: userId,
        $or: [{ lockUntil: { $lt: now } }, { lockUntil: { $exists: false } }, { lockToken: token }],
      },
      { $set: { lockToken: token, lockUntil: new Date(now.getTime() + 300_000), dirty: false } }
    );
    if (await lockCollection.findOne({ _id: userId, lockToken: token })) {
      acquired = true;
      break;
    }
    await wait(100 + Math.floor(Math.random() * 100));
  }
  if (!acquired) throw new Error('Profile rebuild is busy. Please retry shortly.');

  try {
    if (beforeRebuild) await beforeRebuild();
    for (let pass = 0; pass < 10; pass += 1) {
      const sourceFilter = replaceFromSource
        ? { _id: sourceCvId, userId, extractedProfile: { $exists: true } }
        : { userId, extractedProfile: { $exists: true } };
      const sources = await CV.find(sourceFilter)
        .select('extractedProfile createdAt')
        .sort({ createdAt: 1, _id: 1 })
        .lean();
      const prior = await Profile.findOne({ userId }).lean();
      const merged = emptyProfile();
      const overrides = replaceFromSource
        ? { scalars: {}, items: {}, removedItems: {} }
        : (prior?.manualOverrides ?? { scalars: {}, items: {}, removedItems: {} });
      let legacy = replaceFromSource ? undefined : prior?.legacyProtected;
      if (!replaceFromSource && !legacy && prior && !prior.manualOverridesInitialized) {
        legacy = Object.fromEntries(
          [...scalarPaths, ...listKeys, 'customSections'].map((path) => [
            path,
            pathGet(prior, path),
          ])
        );
      }
      for (const path of scalarPaths) {
        const legacyValue = legacy && Object.hasOwn(legacy, path) ? legacy[path] : undefined;
        let value = legacyValue ?? '';
        for (const source of sources) {
          const candidate = pathGet(source.extractedProfile, path);
          if (typeof candidate === 'string' && candidate.trim()) value = candidate;
        }
        if (Object.hasOwn(overrides.scalars ?? {}, path)) value = overrides.scalars[path];
        pathSet(merged, path, value);
      }

      for (const key of listKeys) {
        const items = new Map();
        const upsertItem = (id, item) => {
          const previous = items.get(id);
          if (!previous) {
            items.set(id, item);
            return;
          }
          const combined = { ...previous };
          for (const [field, value] of Object.entries(item)) {
            if (Array.isArray(value)) {
              combined[field] = [
                ...new Map(
                  [...(combined[field] ?? []), ...value].map((entry) => [
                    norm(typeof entry === 'string' ? entry : stable(entry)),
                    entry,
                  ])
                ).values(),
              ];
            } else if (value !== '' && value !== null && value !== undefined) {
              combined[field] = value;
            }
          }
          items.set(id, combined);
        };
        const seed = legacy && Object.hasOwn(legacy, key) ? legacy[key] : [];
        for (const item of Array.isArray(seed) ? seed : []) {
          const id = identity(key, item);
          if (id.replaceAll('|', '')) upsertItem(id, item);
        }
        for (const source of sources) {
          for (const item of source.extractedProfile?.[key] ?? []) {
            const id = identity(key, item);
            if (id.replaceAll('|', '')) upsertItem(id, item);
          }
        }
        for (const [id, item] of Object.entries(overrides.items?.[key] ?? {})) items.set(id, item);
        for (const id of overrides.removedItems?.[key] ?? []) items.delete(id);
        merged[key] = [...items.values()];
      }

      const sections = new Map();
      const mergeSections = (list) => {
        for (const section of list ?? []) {
          const key = sectionKey(section.title);
          if (!key) continue;
          const current = sections.get(key) ?? { title: section.title, fields: new Map() };
          current.title = section.title || current.title;
          for (const field of section.fields ?? []) {
            const fieldKey = norm(field.label);
            if (fieldKey && field.value) current.fields.set(fieldKey, { ...field });
          }
          sections.set(key, current);
        }
      };
      if (legacy && Object.hasOwn(legacy, 'customSections')) mergeSections(legacy.customSections);
      for (const source of sources) mergeSections(source.extractedProfile?.customSections);
      mergeSections(overrides.customSections ?? []);
      for (const item of overrides.removedCustomFields ?? []) {
        sections.get(sectionKey(item.title))?.fields.delete(norm(item.label));
      }
      merged.customSections = [...sections.values()].map((section) => ({
        title: section.title,
        fields: [...section.fields.values()],
      }));

      await Profile.updateOne(
        { userId },
        {
          $set: {
            ...merged,
            legacyProtected: replaceFromSource ? null : (legacy ?? null),
            manualOverrides: overrides,
            manualOverridesInitialized: true,
            manuallyEdited: replaceFromSource ? false : Boolean(prior?.manuallyEdited),
            lastExtractedAt: new Date(),
          },
          $setOnInsert: { userId },
        },
        { upsert: true }
      );
      const state = await lockCollection.findOne({ _id: userId });
      if (!state?.dirty) break;
      await lockCollection.updateOne(
        { _id: userId, lockToken: token },
        { $set: { dirty: false, lockUntil: new Date(Date.now() + 60_000) } }
      );
    }
  } finally {
    await lockCollection.deleteOne({ _id: userId, lockToken: token });
  }
}
