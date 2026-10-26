import mongoose from "mongoose";
import { cvSchema } from "../schemas/cv.schema.js";

export default mongoose.models.CV || mongoose.model("CV", cvSchema);
