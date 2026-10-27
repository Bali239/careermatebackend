import mongoose from 'mongoose';
import { authTokenSchema } from '../schemas/auth-token.schema.js';

export default mongoose.models.AuthToken || mongoose.model('AuthToken', authTokenSchema);
