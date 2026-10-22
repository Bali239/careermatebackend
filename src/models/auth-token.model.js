import mongoose from "mongoose";

const authTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    purpose: { type: String, enum: ["verify-email", "reset-password", "google-state", "google-handoff"], required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export default mongoose.models.AuthToken || mongoose.model("AuthToken", authTokenSchema);
