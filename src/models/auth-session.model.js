import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export default mongoose.models.AuthSession || mongoose.model("AuthSession", authSessionSchema);
