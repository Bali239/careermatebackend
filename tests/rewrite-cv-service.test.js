import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTailoredCvContent, createGeneratedDocumentBuffers } from '../src/services/cv-rewrite.service.js';

const chat = {
  title: 'Senior frontend engineer',
  jobDescription: 'Build customer-facing React features and improve design systems.',
  analysis: {
    summary: 'Strong frontend and product delivery experience.',
    tailoredSummary: 'Product-focused engineer with React and design-system experience.',
    keywords: ['React', 'TypeScript', 'design systems'],
    scoreBreakdown: [{ label: 'Role fit', score: 84, note: 'Strong match.' }],
    strengths: ['Shipping customer-facing features'],
    gaps: ['Need stronger metrics'],
    missingSkills: ['Distributed systems'],
  },
};

test('buildTailoredCvContent preserves factual data and creates a structured profile', () => {
  const content = buildTailoredCvContent({
    fullName: 'Aisha Morgan',
    chat,
    cvText: 'Senior Frontend Engineer with 5 years of React and TypeScript experience. Built dashboards and design systems for product teams.',
  });

  assert.equal(content.fullName, 'Aisha Morgan');
  assert.match(content.professionalSummary, /React|TypeScript|design/i);
  assert.ok(content.skills.includes('React'));
  assert.ok(content.experience.length >= 1);
});

test('createGeneratedDocumentBuffers returns valid DOCX and PDF bytes', async () => {
  const content = buildTailoredCvContent({
    fullName: 'Aisha Morgan',
    chat,
    cvText: 'Senior Frontend Engineer with 5 years of React and TypeScript experience. Built dashboards and design systems for product teams.',
  });

  const buffers = await createGeneratedDocumentBuffers(content);
  assert.ok(buffers.docx.length > 0);
  assert.ok(buffers.pdf.length > 0);
  assert.equal(buffers.docx.subarray(0, 4).toString(), 'PK\x03\x04');
  assert.equal(buffers.pdf.subarray(0, 5).toString(), '%PDF-');
});
