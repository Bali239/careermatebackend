import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  contact: { fullName: { type: String, default: "" }, email: { type: String, default: "" }, phone: { type: String, default: "" }, location: { type: String, default: "" }, website: { type: String, default: "" }, linkedin: { type: String, default: "" }, github: { type: String, default: "" } },
  headline: { type: String, default: "" },
  summary: { type: String, default: "" },
  skills: { type: [String], default: [] },
  experience: { type: [mongoose.Schema.Types.Mixed], default: [] },
  education: { type: [mongoose.Schema.Types.Mixed], default: [] },
  certifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
  projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
  languages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  awards: { type: [mongoose.Schema.Types.Mixed], default: [] },
  interests: { type: [String], default: [] },
  manuallyEdited: { type: Boolean, default: false },
  lastExtractedAt: { type: Date, default: null },
}, { timestamps: true, minimize: false });

export default mongoose.models.Profile || mongoose.model("Profile", profileSchema);
