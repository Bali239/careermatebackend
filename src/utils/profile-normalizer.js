export const emptyProfile = () => ({
  contact: {
    fullName: '',
    email: '',
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
  customSections: [],
  customCategories: [],
});

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

const VALID_TYPES = new Set(['string', 'number', 'boolean', 'array', 'object']);

const normalizeKey = (key) =>
  String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

const cleanCustomCategory = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const key = normalizeKey(raw.key);
  if (!key || FORBIDDEN_KEYS.has(key)) return null;
  const label = normalize(raw.label).slice(0, 100);
  if (!label) return null;
  const type = VALID_TYPES.has(raw.type) ? raw.type : 'string';
  const value =
    raw.value === null || raw.value === undefined
      ? ''
      : typeof raw.value === 'string'
        ? normalize(raw.value).slice(0, 5000)
        : raw.value;
  const evidence = normalize(raw.evidence).slice(0, 1000);
  const confidence =
    typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1
      ? raw.confidence
      : null;
  return { key, label, type, value, evidence, confidence };
};

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');
const sectionHeadingPattern = /^(professional\s+summary|summary|core\s+skills|skills|professional\s+experience|experience|projects?|education|certifications?|languages?|awards?|interests?|contact)$/i;
const contactPattern = /(?:\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:https?:\/\/|www\.)\S+|\+?\d[\d\s().-]{6,}\d)/i;

const normalizeList = (value) =>
  (Array.isArray(value) ? value : [])
    .filter((item) => typeof item === 'string')
    .map(normalize)
    .filter((item) => item && !sectionHeadingPattern.test(item));

const normalizeExperience = (item) => {
  if (!item || typeof item !== 'object') return null;
  const experience = {
    jobTitle: normalize(item.jobTitle),
    company: normalize(item.company),
    location: normalize(item.location),
    startDate: normalize(item.startDate),
    endDate: normalize(item.endDate),
    current: item.current === true,
    description: normalize(item.description),
    achievements: normalizeList(item.achievements),
  };
  const evidence = [
    experience.jobTitle,
    experience.company,
    experience.location,
    experience.startDate,
    experience.endDate,
    experience.description,
    ...experience.achievements,
  ].join(' ');
  if (!experience.jobTitle && !experience.company) return null;
  if (sectionHeadingPattern.test(experience.jobTitle) || contactPattern.test(evidence)) return null;
  if (/^(candidate|professional|full stack|software)\s+(developer|engineer)?$/i.test(experience.jobTitle)) return null;
  if (!experience.company && !experience.startDate && !experience.endDate && !experience.achievements.length) return null;
  return experience;
};

export function cleanExtractedProfile(raw) {
  const result = emptyProfile();
  for (const key of Object.keys(result.contact))
    result.contact[key] = normalize(raw.contact?.[key]);
  result.headline = normalize(raw.headline);
  result.summary = normalize(raw.summary);
  const contactValues = new Set(Object.values(result.contact).map(norm).filter(Boolean));
  result.skills = normalizeList(raw.skills).filter(
    (skill) => !contactPattern.test(skill) && !contactValues.has(norm(skill))
  );
  result.interests = normalizeList(raw.interests);
  result.experience = (Array.isArray(raw.experience) ? raw.experience : [])
    .map(normalizeExperience)
    .filter(Boolean);
  for (const key of [
    'education',
    'certifications',
    'projects',
    'languages',
    'awards',
  ]) {
    result[key] = Array.isArray(raw[key]) ? raw[key].filter((item) => item && typeof item === 'object') : [];
  }
  result.customSections = (Array.isArray(raw.customSections) ? raw.customSections : [])
    .slice(0, 30)
    .map((section) => ({
      title: normalize(section?.title).slice(0, 100),
      fields: (Array.isArray(section?.fields) ? section.fields : [])
        .slice(0, 30)
        .map((field) => ({
          label: normalize(field?.label).slice(0, 100),
          value: normalize(field?.value).slice(0, 3000),
        }))
        .filter((field) => field.label && field.value),
    }))
    .filter((section) => section.title && section.fields.length);

  const seenKeys = new Set();
  result.customCategories = (Array.isArray(raw.customCategories) ? raw.customCategories : [])
    .slice(0, 50)
    .map(cleanCustomCategory)
    .filter(Boolean)
    .filter((cat) => {
      if (seenKeys.has(cat.key)) return false;
      seenKeys.add(cat.key);
      return true;
    });

  return result;
}
