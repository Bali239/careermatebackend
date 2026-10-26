import mongoose from "mongoose";
import { profileMongoSchema } from "../schemas/profile-mongo.schema.js";

export default mongoose.models.Profile || mongoose.model("Profile", profileMongoSchema);
