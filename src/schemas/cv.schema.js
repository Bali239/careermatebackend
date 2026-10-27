import mongoose from 'mongoose';

export const cvSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    fileName: { type: String, required: true, maxlength: 255 },
    contentType: {
      type: String,
      required: true,
      enum: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
    extractionStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    extractionError: { type: String, default: '', maxlength: 300 },
    extractionStartedAt: { type: Date, default: null },
    extractedProfile: { type: mongoose.Schema.Types.Mixed, default: undefined },
    extractionResult: { type: mongoose.Schema.Types.Mixed, default: undefined },
    extractedAt: { type: Date, default: null },
    extractedText: { type: String, default: null },
    extractionMethod: { type: String, default: null },
    textLength: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cvSchema.index({ userId: 1, name: 1 });
