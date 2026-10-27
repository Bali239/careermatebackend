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
});

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');

export function cleanExtractedProfile(raw) {
  const result = emptyProfile();
  for (const key of Object.keys(result.contact))
    result.contact[key] = normalize(raw.contact?.[key]);
  result.headline = normalize(raw.headline);
  result.summary = normalize(raw.summary);
  for (const key of ['skills', 'interests']) {
    result[key] = (Array.isArray(raw[key]) ? raw[key] : [])
      .filter((item) => typeof item === 'string')
      .map(normalize)
      .filter(Boolean);
  }
  for (const key of [
    'experience',
    'education',
    'certifications',
    'projects',
    'languages',
    'awards',
  ]) {
    result[key] = Array.isArray(raw[key])
      ? raw[key].filter((item) => item && typeof item === 'object')
      : [];
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
  return result;
}
