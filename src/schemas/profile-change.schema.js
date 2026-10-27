import mongoose from 'mongoose';

export const profileChangeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cvId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CV',
      required: true,
      index: true,
    },
    extractionHash: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'applied', 'rejected', 'partial'],
      default: 'pending',
    },
    changes: {
      type: [
        {
          fieldPath: { type: String, required: true },
          classification: {
            type: String,
            enum: ['new', 'duplicate', 'enrich', 'conflict', 'outdated', 'unchanged'],
            required: true,
          },
          existingValue: { type: mongoose.Schema.Types.Mixed, default: null },
          proposedValue: { type: mongoose.Schema.Types.Mixed, default: null },
          sourceEvidence: { type: String, default: '' },
          confidence: { type: Number, default: null },
          status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected', 'deferred'],
            default: 'pending',
          },
          resolution: {
            type: String,
            enum: ['keep_existing', 'accept_new', 'manual', 'deferred', null],
            default: null,
          },
          appliedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
    summary: {
      newCount: { type: Number, default: 0 },
      duplicateCount: { type: Number, default: 0 },
      enrichCount: { type: Number, default: 0 },
      conflictCount: { type: Number, default: 0 },
      unchangedCount: { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    appliedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

profileChangeSchema.index({ userId: 1, cvId: 1 });
profileChangeSchema.index({ userId: 1, status: 1 });
