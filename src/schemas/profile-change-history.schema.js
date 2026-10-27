import mongoose from 'mongoose';

export const profileChangeHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    changeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProfileChange',
      default: null,
    },
    cvId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CV',
      default: null,
    },
    fieldPath: { type: String, required: true },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    classification: { type: String, default: '' },
    source: { type: String, default: 'ai' },
    aiProposed: { type: Boolean, default: true },
    userConfirmed: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    revertedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

profileChangeHistorySchema.index({ userId: 1, timestamp: -1 });
