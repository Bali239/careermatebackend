import Profile from '../models/profile.model.js';

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

const pathGet = (target, path) => path.split('.').reduce((object, key) => object?.[key], target);

const itemIdentity = (key, item) => {
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

/**
 * Compare an extracted profile against the existing master profile.
 * Returns a change set with classifications for each proposed change.
 */
export async function compareProfiles(userId, extractedProfile) {
  const existing = await Profile.findOne({ userId }).lean();
  const changes = [];
  let newCount = 0;
  let duplicateCount = 0;
  let enrichCount = 0;
  let conflictCount = 0;
  let unchangedCount = 0;

  // Scalar fields
  for (const path of scalarPaths) {
    const existingValue = pathGet(existing, path) ?? '';
    const proposedValue = pathGet(extractedProfile, path) ?? '';

    if (!proposedValue || !String(proposedValue).trim()) {
      unchangedCount++;
      continue;
    }

    if (!existingValue || !String(existingValue).trim()) {
      changes.push({
        fieldPath: path,
        classification: 'new',
        existingValue: null,
        proposedValue,
        sourceEvidence: '',
        confidence: null,
        status: 'pending',
      });
      newCount++;
    } else if (norm(existingValue) === norm(proposedValue)) {
      unchangedCount++;
    } else {
      changes.push({
        fieldPath: path,
        classification: 'conflict',
        existingValue,
        proposedValue,
        sourceEvidence: '',
        confidence: null,
        status: 'pending',
      });
      conflictCount++;
    }
  }

  // List fields
  for (const key of listKeys) {
    const existingItems = Array.isArray(existing?.[key]) ? existing[key] : [];
    const proposedItems = Array.isArray(extractedProfile?.[key]) ? extractedProfile[key] : [];

    const existingMap = new Map(existingItems.map((item) => [itemIdentity(key, item), item]));
    const proposedMap = new Map(proposedItems.map((item) => [itemIdentity(key, item), item]));

    for (const [id, item] of proposedMap) {
      if (existingMap.has(id)) {
        const existingItem = existingMap.get(id);
        // Check if there's enrichment (additional non-empty fields)
        const hasNewFields = Object.keys(item).some(
          (k) =>
            item[k] !== '' &&
            item[k] !== null &&
            item[k] !== undefined &&
            item[k] !== existingItem[k]
        );
        if (hasNewFields) {
          changes.push({
            fieldPath: `${key}[${id}]`,
            classification: 'enrich',
            existingValue: existingItem,
            proposedValue: item,
            sourceEvidence: '',
            confidence: null,
            status: 'pending',
          });
          enrichCount++;
        } else {
          duplicateCount++;
        }
      } else {
        changes.push({
          fieldPath: `${key}[${id}]`,
          classification: 'new',
          existingValue: null,
          proposedValue: item,
          sourceEvidence: '',
          confidence: null,
          status: 'pending',
        });
        newCount++;
      }
    }
  }

  // Custom sections
  const existingSections = new Map((existing?.customSections ?? []).map((s) => [norm(s.title), s]));
  for (const section of extractedProfile?.customSections ?? []) {
    const key = norm(section.title);
    if (!key) continue;
    if (existingSections.has(key)) {
      duplicateCount++;
    } else {
      changes.push({
        fieldPath: `customSections[${key}]`,
        classification: 'new',
        existingValue: null,
        proposedValue: section,
        sourceEvidence: '',
        confidence: null,
        status: 'pending',
      });
      newCount++;
    }
  }

  // Custom categories (dynamic fields)
  const existingCats = existing?.customCategories ?? {};
  for (const cat of extractedProfile?.customCategories ?? []) {
    if (!cat || !cat.key) continue;
    const key = cat.key;
    if (existingCats[key]) {
      if (JSON.stringify(existingCats[key].value) !== JSON.stringify(cat.value)) {
        changes.push({
          fieldPath: `customCategories.${key}`,
          classification: 'conflict',
          existingValue: existingCats[key],
          proposedValue: cat,
          sourceEvidence: cat.evidence || '',
          confidence: cat.confidence,
          status: 'pending',
        });
        conflictCount++;
      } else {
        duplicateCount++;
      }
    } else {
      changes.push({
        fieldPath: `customCategories.${key}`,
        classification: 'new',
        existingValue: null,
        proposedValue: cat,
        sourceEvidence: cat.evidence || '',
        confidence: cat.confidence,
        status: 'pending',
      });
      newCount++;
    }
  }

  return {
    changes,
    summary: {
      newCount,
      duplicateCount,
      enrichCount,
      conflictCount,
      unchangedCount,
    },
  };
}
