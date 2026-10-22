import mongoose from "mongoose";

const cvSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  fileName: { type: String, required: true, maxlength: 255 },
  contentType: { type: String, required: true, enum: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true });

cvSchema.index({ userId: 1, name: 1 });
export default mongoose.models.CV || mongoose.model("CV", cvSchema);
