import mongoose from "mongoose";
import { userSchema } from "../schemas/user.schema.js";

export default mongoose.models.User || mongoose.model("User", userSchema);
