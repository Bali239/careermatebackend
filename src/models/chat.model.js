import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true, maxlength: 8000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const chatAnalysisSchema = new mongoose.Schema(
  {
    summary: { type: String, required: true, maxlength: 2000 },
    atsScore: { type: Number, required: true, min: 0, max: 100 },
    strengths: { type: [String], default: [], maxlength: 20 },
    gaps: { type: [String], default: [], maxlength: 20 },
    missingSkills: { type: [String], default: [], maxlength: 20 },
    recommendations: { type: [String], default: [], maxlength: 20 },
    keywords: { type: [String], default: [], maxlength: 50 },
    tailoredSummary: { type: String, required: true, maxlength: 3000 },
    editableHtml: { type: String, required: true, maxlength: 250000 },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cvId: { type: mongoose.Schema.Types.ObjectId, ref: 'CV', required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    jobDescription: { type: String, required: true, maxlength: 8000 },
    analysis: { type: chatAnalysisSchema, default: null },
    draftHtml: { type: String, default: '', maxlength: 250000 },
    isEditing: { type: Boolean, default: false },
    messages: { type: [chatMessageSchema], default: [] },
    status: { type: String, enum: ['idle', 'analyzing', 'done', 'error'], default: 'idle' },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.Chat || mongoose.model('Chat', chatSchema);
