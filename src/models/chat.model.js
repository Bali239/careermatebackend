import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true, maxlength: 8000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const scoreBreakdownSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, maxlength: 80 },
    score: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String, required: true, maxlength: 500 },
  },
  { _id: false }
);

const overallJobMatchSchema = new mongoose.Schema(
  {
    score: { type: Number, required: true, min: 0, max: 100 },
    technicalSkills: { type: Number, min: 0, max: 100 },
    experienceRelevance: { type: Number, min: 0, max: 100 },
    educationAlignment: { type: Number, min: 0, max: 100 },
    keywordCoverage: { type: Number, min: 0, max: 100 },
    evidenceQuality: { type: Number, min: 0, max: 100 },
    explanation: { type: String, maxlength: 1000 },
    strongestAreas: { type: [String], default: [], maxlength: 10 },
    biggestGaps: { type: [String], default: [], maxlength: 10 },
  },
  { _id: false }
);

const requirementComparisonItemSchema = new mongoose.Schema(
  {
    requirement: { type: String, required: true, maxlength: 200 },
    status: {
      type: String,
      enum: ['matched', 'partially matched', 'not demonstrated', 'unclear'],
      required: true,
    },
    importance: { type: String, enum: ['required', 'preferred', 'optional'], required: true },
    evidence: { type: [String], default: [], maxlength: 10 },
    explanation: { type: String, required: true, maxlength: 600 },
    nextAction: { type: String, required: true, maxlength: 400 },
  },
  { _id: false }
);

const atsReadinessSchema = new mongoose.Schema(
  {
    keywordCoverage: { type: String, required: true, maxlength: 200 },
    standardHeadings: { type: String, required: true, maxlength: 200 },
    contactInformation: { type: String, required: true, maxlength: 200 },
    chronology: { type: String, required: true, maxlength: 200 },
    readability: { type: String, required: true, maxlength: 200 },
    quantifiedAchievements: { type: String, required: true, maxlength: 200 },
    technicalDocumentChecks: { type: [String], default: [], maxlength: 20 },
    aiRecommendations: { type: [String], default: [], maxlength: 20 },
  },
  { _id: false }
);

const experienceInsightSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    relevance: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    evidence: { type: [String], default: [], maxlength: 10 },
    skillsDemonstrated: { type: [String], default: [], maxlength: 20 },
    weaknesses: { type: [String], default: [], maxlength: 10 },
    priorities: { type: [String], default: [], maxlength: 10 },
  },
  { _id: false }
);

const jobDescriptionBreakdownSchema = new mongoose.Schema(
  {
    title: { type: String, maxlength: 200 },
    seniority: { type: String, maxlength: 120 },
    responsibilities: { type: [String], default: [], maxlength: 20 },
    requiredSkills: { type: [String], default: [], maxlength: 20 },
    preferredSkills: { type: [String], default: [], maxlength: 20 },
    education: { type: [String], default: [], maxlength: 20 },
    certifications: { type: [String], default: [], maxlength: 20 },
    experienceRequirements: { type: [String], default: [], maxlength: 20 },
    technologies: { type: [String], default: [], maxlength: 20 },
    softSkills: { type: [String], default: [], maxlength: 20 },
    keywords: { type: [String], default: [], maxlength: 50 },
    majorExpectations: { type: [String], default: [], maxlength: 20 },
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema(
  {
    issue: { type: String, required: true, maxlength: 400 },
    whyItMatters: { type: String, required: true, maxlength: 500 },
    suggestedImprovement: { type: String, required: true, maxlength: 500 },
    relevantSection: { type: String, required: true, maxlength: 120 },
    requiresAdditionalInfo: { type: Boolean, default: false },
  },
  { _id: false }
);

const generatedCvVersionSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    filename: { type: String, required: true, maxlength: 255 },
    docxFileName: { type: String, maxlength: 255 },
    pdfFileName: { type: String, maxlength: 255 },
    docxRef: { type: String, maxlength: 500 },
    pdfRef: { type: String, maxlength: 500 },
    summary: { type: String, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
    error: { type: String, default: '', maxlength: 500 },
  },
  { _id: true }
);

const chatAnalysisSchema = new mongoose.Schema(
  {
    summary: { type: String, required: true, maxlength: 2000 },
    atsScore: { type: Number, required: true, min: 0, max: 100 },
    overallScore: { type: Number, default: 0, min: 0, max: 100 },
    overallJobMatch: { type: overallJobMatchSchema, default: null },
    skillsComparison: { type: [requirementComparisonItemSchema], default: [] },
    atsReadiness: { type: atsReadinessSchema, default: null },
    experienceInsights: { type: [experienceInsightSchema], default: [] },
    jobDescriptionBreakdown: { type: jobDescriptionBreakdownSchema, default: null },
    recommendations: { type: [recommendationSchema], default: [] },
    strengths: { type: [String], default: [], maxlength: 20 },
    gaps: { type: [String], default: [], maxlength: 20 },
    missingSkills: { type: [String], default: [], maxlength: 20 },
    keywords: { type: [String], default: [], maxlength: 50 },
    tailoredSummary: { type: String, required: true, maxlength: 3000 },
    editableHtml: { type: String, required: true, maxlength: 250000 },
    scoreBreakdown: { type: [scoreBreakdownSchema], default: [] },
    generatedAt: { type: Date, default: null },
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
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    analysisError: { type: String, default: '', maxlength: 500 },
    draftHtml: { type: String, default: '', maxlength: 250000 },
    isEditing: { type: Boolean, default: false },
    messages: { type: [chatMessageSchema], default: [] },
    status: { type: String, enum: ['idle', 'analyzing', 'done', 'error'], default: 'idle' },
    error: { type: String, default: '' },
    generatedCvVersions: { type: [generatedCvVersionSchema], default: [] },
    sourceCvName: { type: String, default: '', maxlength: 120 },
    sourceCvFileName: { type: String, default: '', maxlength: 255 },
  },
  { timestamps: true }
);

chatSchema.index({ userId: 1, createdAt: -1 });
chatSchema.index({ userId: 1, status: 1 });

export default mongoose.models.Chat || mongoose.model('Chat', chatSchema);
