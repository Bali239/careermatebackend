import mongoose from 'mongoose';
import { authSessionSchema } from '../schemas/auth-session.schema.js';

export default mongoose.models.AuthSession || mongoose.model('AuthSession', authSessionSchema);
