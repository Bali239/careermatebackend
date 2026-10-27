import Profile from '../models/profile.model.js';
import ProfileChangeHistory from '../models/profile-change-history.model.js';

const norm = (value) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');

const pathGet = (target, path) => path.split('.').reduce((object, key) => object?.[key], target);
const pathSet = (target, path, value) => {
  const parts = path.split('.');
  const leaf = parts.pop();
  const owner = parts.reduce((object, key) => (object[key] ??= {}), target);
  owner[leaf] = value;
};

/**
 * Apply approved changes to the master profile with optimistic concurrency control.
 * @param {string} userId
 * @param {Array} approvedChanges - changes with status 'accepted'
 * @param {string} cvId
 * @param {string} changeId
 * @returns {Promise<{ success: boolean, version: number }>}
 */
export async function applyChanges(userId, approvedChanges, cvId, changeId) {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const profile = await Profile.findOne({ userId }).lean();
    const currentVersion = profile?.version ?? 0;

    const update = { $set: {}, $inc: { version: 1 } };
    const historyEntries = [];

    for (const change of approvedChanges) {
      if (change.status !== 'accepted') continue;
      const { fieldPath, classification, proposedValue } = change;

      // Handle custom categories
      if (fieldPath.startsWith('customCategories.')) {
        const key = fieldPath.replace('customCategories.', '');
        if (!profile.customCategories) profile.customCategories = {};
        const existing = profile.customCategories[key];
        if (classification === 'new' || !existing) {
          update.$set[`customCategories.${key}`] = proposedValue;
        } else if (classification === 'enrich') {
          update.$set[`customCategories.${key}`] = { ...existing, ...proposedValue };
        }
        historyEntries.push({
          userId,
          changeId,
          cvId,
          fieldPath,
          previousValue: existing ?? null,
          newValue: proposedValue,
          classification,
          source: 'ai',
          aiProposed: true,
          userConfirmed: true,
        });
        continue;
      }

      // Handle list items (e.g., skills[...], experience[...])
      if (fieldPath.includes('[')) {
        const [key, idPart] = fieldPath.split('[');
        const id = idPart.replace(']', '');
        const list = Array.isArray(profile?.[key]) ? profile[key] : [];
        const idx = list.findIndex((item) => {
          const itemKey =
            key === 'skills' || key === 'interests'
              ? norm(item)
              : item.name || item.jobTitle || item.institution || JSON.stringify(item);
          return norm(itemKey) === norm(id);
        });

        if (classification === 'new' && idx === -1) {
          list.push(proposedValue);
          update.$set[key] = list;
        } else if (classification === 'enrich' && idx !== -1) {
          const merged = { ...list[idx] };
          for (const [k, v] of Object.entries(proposedValue)) {
            if (v !== '' && v !== null && v !== undefined) {
              if (Array.isArray(v) && Array.isArray(merged[k])) {
                merged[k] = [...new Set([...merged[k], ...v])];
              } else {
                merged[k] = v;
              }
            }
          }
          list[idx] = merged;
          update.$set[key] = list;
        }

        historyEntries.push({
          userId,
          changeId,
          cvId,
          fieldPath,
          previousValue: idx !== -1 ? list[idx] : null,
          newValue: proposedValue,
          classification,
          source: 'ai',
          aiProposed: true,
          userConfirmed: true,
        });
        continue;
      }

      // Handle scalar fields and customSections
      const existingValue = pathGet(profile, fieldPath);
      if (classification === 'new' || classification === 'enrich') {
        update.$set[fieldPath] = proposedValue;
        historyEntries.push({
          userId,
          changeId,
          cvId,
          fieldPath,
          previousValue: existingValue ?? null,
          newValue: proposedValue,
          classification,
          source: 'ai',
          aiProposed: true,
          userConfirmed: true,
        });
      }
    }

    // Apply update with optimistic concurrency
    const result = await Profile.updateOne({ userId, version: currentVersion }, update);

    if (result.modifiedCount === 0) {
      // Conflict — retry
      if (attempt < maxRetries - 1) continue;
      return { success: false, version: currentVersion, error: 'Concurrent update conflict' };
    }

    // Record history
    if (historyEntries.length > 0) {
      await ProfileChangeHistory.insertMany(historyEntries);
    }

    return { success: true, version: currentVersion + 1 };
  }

  return { success: false, error: 'Max retries exceeded' };
}
