import { z } from 'zod';

const text = z.string().trim().max(5000);
const contactSchema = z.object({
  fullName: text,
  email: z.string().trim().max(254),
  phone: text,
  location: text,
  website: text,
  linkedin: text,
  github: text,
});
const experienceSchema = z.object({
  jobTitle: text,
  company: text,
  location: text,
  startDate: text,
  endDate: text,
  current: z.boolean(),
  description: text,
  achievements: z.array(text).max(30),
});
const educationSchema = z.object({
  institution: text,
  degree: text,
  field: text,
  location: text,
  startDate: text,
  endDate: text,
  details: text,
});
const certificationSchema = z.object({
  name: text,
  issuer: text,
  issueDate: text,
  expirationDate: text,
  credentialUrl: text,
});
const projectSchema = z.object({
  name: text,
  role: text,
  description: text,
  url: text,
  technologies: z.array(text).max(40),
});
const languageSchema = z.object({ name: text, proficiency: text });
const awardSchema = z.object({ name: text, issuer: text, date: text, description: text });
const customSectionsSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(100),
      fields: z
        .array(
          z.object({
            label: z.string().trim().min(1).max(100),
            value: text,
          })
        )
        .max(30),
    })
  )
  .max(30);

export const profileSchema = z.object({
  contact: contactSchema,
  headline: text,
  summary: text,
  skills: z.array(text).max(100),
  experience: z.array(experienceSchema).max(50),
  education: z.array(educationSchema).max(50),
  certifications: z.array(certificationSchema).max(50),
  projects: z.array(projectSchema).max(50),
  languages: z.array(languageSchema).max(30),
  awards: z.array(awardSchema).max(50),
  interests: z.array(text).max(50),
  customSections: customSectionsSchema.default([]),
});
