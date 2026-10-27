import mongoose from 'mongoose';
import { profileChangeHistorySchema } from '../schemas/profile-change-history.schema.js';

export default mongoose.models.ProfileChangeHistory ||
  mongoose.model('ProfileChangeHistory', profileChangeHistorySchema);
