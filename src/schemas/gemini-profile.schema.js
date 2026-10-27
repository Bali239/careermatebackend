export const geminiProfileSchema = {
  type: 'OBJECT',
  properties: {
    contact: {
      type: 'OBJECT',
      properties: {
        fullName: { type: 'STRING' },
        email: { type: 'STRING' },
        phone: { type: 'STRING' },
        location: { type: 'STRING' },
        website: { type: 'STRING' },
        linkedin: { type: 'STRING' },
        github: { type: 'STRING' },
      },
      required: ['fullName', 'email', 'phone', 'location', 'website', 'linkedin', 'github'],
    },
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    skills: { type: 'ARRAY', items: { type: 'STRING' } },
    experience: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          jobTitle: { type: 'STRING' },
          company: { type: 'STRING' },
          location: { type: 'STRING' },
          startDate: { type: 'STRING' },
          endDate: { type: 'STRING' },
          current: { type: 'BOOLEAN' },
          description: { type: 'STRING' },
          achievements: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: [
          'jobTitle',
          'company',
          'location',
          'startDate',
          'endDate',
          'current',
          'description',
          'achievements',
        ],
      },
    },
    education: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          institution: { type: 'STRING' },
          degree: { type: 'STRING' },
          field: { type: 'STRING' },
          location: { type: 'STRING' },
          startDate: { type: 'STRING' },
          endDate: { type: 'STRING' },
          details: { type: 'STRING' },
        },
        required: ['institution', 'degree', 'field', 'location', 'startDate', 'endDate', 'details'],
      },
    },
    certifications: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          issuer: { type: 'STRING' },
          issueDate: { type: 'STRING' },
          expirationDate: { type: 'STRING' },
          credentialUrl: { type: 'STRING' },
        },
        required: ['name', 'issuer', 'issueDate', 'expirationDate', 'credentialUrl'],
      },
    },
    projects: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          role: { type: 'STRING' },
          description: { type: 'STRING' },
          url: { type: 'STRING' },
          technologies: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['name', 'role', 'description', 'url', 'technologies'],
      },
    },
    languages: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, proficiency: { type: 'STRING' } },
        required: ['name', 'proficiency'],
      },
    },
    awards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          issuer: { type: 'STRING' },
          date: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['name', 'issuer', 'date', 'description'],
      },
    },
    interests: { type: 'ARRAY', items: { type: 'STRING' } },
    customSections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          fields: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { label: { type: 'STRING' }, value: { type: 'STRING' } },
              required: ['label', 'value'],
            },
          },
        },
        required: ['title', 'fields'],
      },
    },
    customCategories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          label: { type: 'STRING' },
          type: { type: 'STRING' },
          value: { type: 'STRING' },
          evidence: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['key', 'label', 'type', 'value'],
      },
    },
    sourceEvidence: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          field: { type: 'STRING' },
          snippet: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['field', 'snippet'],
      },
    },
  },
  required: [
    'contact',
    'headline',
    'summary',
    'skills',
    'experience',
    'education',
    'certifications',
    'projects',
    'languages',
    'awards',
    'interests',
    'customSections',
  ],
};
