import CV from '../models/cv.model.js';
import Profile from '../models/profile.model.js';
import { extractProfileWithGemini } from './gemini-profile.service.js';
import { rebuildUserProfile } from './profile-rebuild.service.js';
import { extractDocumentText } from '../utils/cv-document-text.js';
import { processCV } from './profile-extraction.service.js';
import { compareProfiles } from './profile-comparison.service.js';
import ProfileChange from '../models/profile-change.model.js';

export async function queueUnprocessedCVs(userId) {
  const staleProcessing = new Date(Date.now() - 15 * 60_000);
  const pending = await CV.find({
    userId,
    extractedProfile: { $exists: false },
    $or: [
      { extractionStatus: { $ne: 'processing' } },
      { extractionStartedAt: { $lt: staleProcessing } },
      { extractionStartedAt: null },
    ],
  })
    .select('_id extractionStatus extractionStartedAt')
    .lean();
  for (const cv of pending) {
    if (cv.extractionStatus !== 'pending' && cv.extractionStatus !== 'processing') {
      await CV.updateOne(
        {
          _id: cv._id,
          userId,
          extractionStatus: cv.extractionStatus,
          extractedProfile: { $exists: false },
        },
        { $set: { extractionStatus: 'pending', extractionError: '' } }
      );
    }
    void extractCVProfile(cv._id, userId);
  }
}

export async function extractCVProfile(cvId, userId) {
  let extractionSaved = false;
  try {
    const staleProcessing = new Date(Date.now() - 15 * 60_000);
    const claim = await CV.updateOne(
      {
        _id: cvId,
        userId,
        $or: [
          { extractionStatus: { $ne: 'processing' } },
          { extractionStartedAt: { $lt: staleProcessing } },
          { extractionStartedAt: null },
        ],
      },
      {
        $set: {
          extractionStatus: 'processing',
          extractionStartedAt: new Date(),
          extractionError: '',
        },
      }
    );
    if (!claim.modifiedCount) return;
    const cv = await CV.findOne({ _id: cvId, userId }).select('+data');
    if (!cv) return;
    if (cv.extractionStatus === 'completed' && cv.extractedText) {
      return;
    }
    const text = await extractDocumentText(cv);
    const usableText = text ?? '';
    if (!usableText.trim()) {
      const error = new Error('No usable text could be extracted from the document');
      await CV.updateOne(
        { _id: cvId, userId },
        {
          $set: {
            extractionStatus: 'failed',
            extractionError: error.message.slice(0, 300),
            extractedText: null,
            extractionMethod: null,
            textLength: 0,
          },
          $unset: { extractionStartedAt: 1 },
        }
      );
      throw error;
    }
    const extracted = await extractProfileWithGemini(cv, usableText);

    // Save extraction result + extracted text
    const saved = await CV.updateOne(
      { _id: cvId, userId },
      {
        $set: {
          extractedProfile: extracted,
          extractionResult: extracted,
          extractedAt: new Date(),
          extractionStatus: 'completed',
          extractionError: '',
          extractedText: usableText,
          extractionMethod:
            cv.contentType ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              ? 'mammoth'
              : cv.contentType === 'application/msword'
                ? 'word-extractor'
                : 'pdf-parser',
          textLength: usableText.length,
        },
        $unset: { extractionStartedAt: 1 },
      }
    );
    if (saved.modifiedCount) {
      extractionSaved = true;

      // Compare against master profile and create change proposal
      const { changes, summary } = await compareProfiles(userId, extracted);

      // Create a ProfileChange record for review
      const extractionHash = JSON.stringify(extracted).slice(0, 64);
      await ProfileChange.create({
        userId,
        cvId,
        extractionHash,
        changes,
        summary,
        status: 'pending',
      });

      // Keep legacy rebuild for backward compat (runs in background)
      const lockCollection = Profile.db.collection('profile_rebuild_locks');
      await lockCollection.updateOne({ _id: userId }, { $set: { dirty: true } }, { upsert: true });
      await rebuildUserProfile(userId);
    }
  } catch (error) {
    console.error('CV profile extraction failed:', error.message);
    if (!extractionSaved) {
      await CV.updateOne(
        { _id: cvId, userId },
        {
          $set: { extractionStatus: 'failed', extractionError: error.message.slice(0, 300) },
          $unset: { extractionStartedAt: 1 },
        }
      );
    }
  }
}
