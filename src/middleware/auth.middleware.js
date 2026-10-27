import AuthSession from '../models/auth-session.model.js';
import User from '../models/user.model.js';
import { httpError } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/access-token.js';

export async function requireAuth(req, res, next) {
  try {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw httpError(401, 'Authentication required');
    const claims = verifyAccessToken(token);
    const session = await AuthSession.findOne({
      _id: claims.sid,
      userId: claims.sub,
      $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }],
      expiresAt: { $gt: new Date() },
    });
    if (!session) throw httpError(401, 'Session is invalid or expired');
    const user = await User.findById(claims.sub);
    if (!user) throw httpError(401, 'Authentication required');
    req.authUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
