import CV from '../models/cv.model.js';
import { extractProfileWithGemini } from './gemini-profile.service.js';
import { extractDocumentText } from '../utils/cv-document-text.js';
import { cleanExtractedProfile } from '../utils/profile-normalizer.js';

/**
 * Extract structured profile data from a CV document.
 * Returns the cleaned extracted profile.
 */
export async function extractProfileFromCV(cv, text) {
  const extracted = await extractProfileWithGemini(cv, text);
  return cleanExtractedProfile(extracted);
}

/**
 * Process a CV: extract text, run Gemini, save result.
 * Returns the extracted profile.
 */
export async function processCV(cvId, userId) {
  const cv = await CV.findOne({ _id: cvId, userId }).select('+data');
  if (!cv) throw new Error('CV not found');

  const text = await extractDocumentText(cv);
  const extracted = await extractProfileFromCV(cv, text);

  await CV.updateOne(
    { _id: cvId, userId },
    {
      $set: {
        extractedProfile: extracted,
        extractionResult: extracted,
        extractedAt: new Date(),
        extractionStatus: 'completed',
        extractionError: '',
      },
      $unset: { extractionStartedAt: 1 },
    }
  );

  return extracted;
}
