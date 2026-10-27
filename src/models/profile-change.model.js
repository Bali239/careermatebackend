import mongoose from 'mongoose';
import { profileChangeSchema } from '../schemas/profile-change.schema.js';

export default mongoose.models.ProfileChange ||
  mongoose.model('ProfileChange', profileChangeSchema);
